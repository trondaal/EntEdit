import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type {
  SparqlEndpointConfig,
  RdfProperty,
  OrderedValue,
} from "../types/sparql";
import { SparqlClient, SparqlError } from "../utils/sparqlClient";
import {
  escapeSparqlLiteral,
  formatLabel,
  generateEntityUri,
  sanitizeSparqlUri,
} from "../utils/labelUtils";
import {
  buildEntityUpdate,
  buildInverseCleanup,
  changedProperties,
  findConflicts,
  RDF_TYPE,
  RDFS_LABEL,
  type DesiredTerm,
} from "../utils/entityUpdate";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { useLogging } from "./useLogging";
import { loadEntitySnapshot } from "./useEntityQueries";
import type { EntityLabel, LoadedEntity } from "./useEntityQueries";

interface UseEntityMutationsParams {
  config: SparqlEndpointConfig;
  classUri: string;
  entityUri: string | null;
  /** Custom URI typed by the user when creating a new entity. Ignored when `entityUri` is set. */
  customEntityUri: string;
  entityData: Record<string, OrderedValue[]>;
  entityLabels: EntityLabel[];
  /** The server-side snapshot loaded by `useEntityQuery`. Used only to diff
   * removed object-property values so we can clean up asserted inverse triples. */
  existingEntity: LoadedEntity | null | undefined;
  /** Data properties for the current class — used to pick a primary-property
   * fallback label when the user didn't provide any explicit rdfs:label. */
  properties: RdfProperty[];
  /** Set of all object-property URIs managed by the editor (used both for
   * serialization and to scope the managed-property delete on update). */
  objectPropertyUris: Set<string>;
  /** Called on successful save so the parent can reset form/dirty state. */
  onSaveSuccess: (args: { isNew: boolean; savedEntityUri: string }) => void;
  /** Called on successful delete so the parent can deselect the entity. */
  onDeleteSuccess: () => void;
  /** Called from the "Create another" action after an entity was created. */
  onCreateAnother: () => void;
}

export interface UseEntityMutationsResult {
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  saving: boolean;
  deleting: boolean;
  saveError: string | null;
  deleteError: string | null;
  /** Clear saveError (e.g. when the user dismisses an Alert). */
  clearSaveError: () => void;
  /** Clear deleteError (e.g. when the delete dialog closes). */
  clearDeleteError: () => void;
}

/**
 * Encapsulates the entity save + delete flow previously inlined in
 * EntityEditor: SPARQL update construction, cache invalidation, logging,
 * snackbar notifications, and error state.
 *
 * `existingEntity` is held in a ref so a background cache refresh while the
 * user is editing doesn't recreate `handleSave` mid-edit (see code-review
 * issue #2). Only the fields that actually vary with user input appear in
 * `handleSave`'s dependency array.
 */
export function useEntityMutations({
  config,
  classUri,
  entityUri,
  customEntityUri,
  entityData,
  entityLabels,
  existingEntity,
  properties,
  objectPropertyUris,
  onSaveSuccess,
  onDeleteSuccess,
  onCreateAnother,
}: UseEntityMutationsParams): UseEntityMutationsResult {
  const queryClient = useQueryClient();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t, i18n } = useTranslation("entityEditor");
  const { logEvent, isRecording } = useLogging();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formatMutationError = useCallback(
    (error: unknown): string => {
      if (error instanceof SparqlError) {
        return t(`messages.writeError.${error.code}`);
      }
      return (error as Error).message;
    },
    [t],
  );

  // Keep existingEntity in a ref so handleSave's identity isn't churned by
  // background cache refetches.
  const existingEntityRef = useRef(existingEntity);
  useEffect(() => {
    existingEntityRef.current = existingEntity;
  }, [existingEntity]);

  const handleSave = useCallback(async () => {
    if (!classUri) return; // Don't save if no class is selected

    setSaving(true);
    setSaveError(null);

    try {
      const client = new SparqlClient(config);
      // Use existing URI, custom URI, or generate one
      const currentEntityUri =
        entityUri || customEntityUri.trim() || generateEntityUri(classUri);

      // A new entity must not reuse an identifier that is already described:
      // INSERT DATA would silently merge the two (e.g. a Person also becoming a Work).
      if (!entityUri && customEntityUri.trim()) {
        const existing = await findExistingEntity(client, currentEntityUri, i18n.language);
        if (existing) {
          setSaveError(t("messages.uriInUse", existing));
          return;
        }
      }

      // Collect all affected entity URIs (entities that are objects in relationships)
      const affectedEntityUris = new Set<string>();

      // If updating an existing entity, query for all related entities before deletion
      if (entityUri) {
        const findRelatedQuery = `
          SELECT DISTINCT ?relatedEntity WHERE {
            {
              <${sanitizeSparqlUri(entityUri)}> ?p ?relatedEntity .
              FILTER (isIRI(?relatedEntity))
            }
            UNION
            {
              ?relatedEntity ?p2 <${sanitizeSparqlUri(entityUri)}> .
            }
          }
        `;
        const relatedEntities = await client.query(findRelatedQuery);
        relatedEntities.results.bindings.forEach((binding) => {
          if (binding.relatedEntity?.value) {
            affectedEntityUris.add(binding.relatedEntity.value);
          }
        });
      }

      // Also collect entity URIs from the new data being saved (object properties only)
      Object.entries(entityData).forEach(([property, values]) => {
        if (objectPropertyUris.has(property)) {
          values.forEach(({ value }) => {
            if (value.trim()) affectedEntityUris.add(value);
          });
        }
      });

      // Build the terms the form wants to exist. Values that only exist
      // through inference are shown read-only and never written back.
      const desired: DesiredTerm[] = [
        { property: RDF_TYPE, value: classUri, isUri: true, order: 0 },
      ];

      const hasUserLabel = entityLabels.some((l) => l.value.trim());
      entityLabels.forEach((label, index) => {
        if (label.value.trim()) {
          desired.push({
            property: RDFS_LABEL,
            value: label.value,
            lang: label.language || undefined,
            order: index,
          });
        }
      });

      // Fallback: without an explicit label, derive an untagged one from the
      // value of the property with order 1.
      if (!hasUserLabel) {
        const primaryProperty = properties.find((p) => p.order === 1);
        const primaryValue = primaryProperty
          ? (entityData[primaryProperty.uri] || []).find(
              (v) => v.value.trim() && !v.isUri && !v.inferred,
            )?.value.trim()
          : undefined;
        if (primaryValue) {
          desired.push({ property: RDFS_LABEL, value: primaryValue, order: 0 });
        }
      }

      Object.entries(entityData).forEach(([property, values]) => {
        let order = 0;
        values.forEach((value) => {
          if (!value.value.trim() || value.inferred) return;
          desired.push({
            property,
            value: value.value,
            // isUri from the loaded binding also covers relationship
            // properties the editor does not manage.
            isUri: objectPropertyUris.has(property) || value.isUri,
            lang: value.lang,
            datatype: value.datatype,
            order: order++,
          });
        });
      });

      const managedProperties = new Set<string>([RDF_TYPE, RDFS_LABEL]);
      properties.forEach((p) => managedProperties.add(p.uri));
      objectPropertyUris.forEach((uri) => managedProperties.add(uri));

      const loaded = existingEntityRef.current;
      const snapshot = entityUri ? (loaded?.snapshot ?? []) : [];
      const willWrite = changedProperties(snapshot, desired, managedProperties);

      // Someone else may have changed the entity while it was open. Only the
      // properties this save writes are compared, so unrelated edits by
      // others are left in place rather than blocking the save.
      if (entityUri && willWrite.size > 0) {
        const current = await loadEntitySnapshot(client, entityUri);
        const conflicts = findConflicts(snapshot, current, willWrite);
        if (conflicts.length > 0) {
          setSaveError(
            t("messages.saveConflict", {
              properties: conflicts
                .map((uri) => propertyLabel(properties, uri))
                .join(", "),
            }),
          );
          return;
        }
      }

      // Relationship values the user removed: their inverse triples on the
      // other entity have to go too, or the link reappears through inference.
      const removedRelations: Array<{ property: string; value: string }> = [];
      const desiredKeys = new Set(
        desired.map((term) => `${term.property}|${term.value}`),
      );
      for (const term of snapshot) {
        if (!term.isUri || !managedProperties.has(term.property)) continue;
        if (!desiredKeys.has(`${term.property}|${term.value}`)) {
          removedRelations.push({ property: term.property, value: term.value });
          affectedEntityUris.add(term.value);
        }
      }

      const update = [
        buildEntityUpdate({
          entityUri: currentEntityUri,
          snapshot,
          desired,
          managedProperties,
          targetGraph: entityUri ? loaded?.targetGraph : undefined,
        }),
        buildInverseCleanup(currentEntityUri, removedRelations),
      ]
        .filter(Boolean)
        .join(" ;\n");

      if (update) {
        await client.update(update);
      }

      // Invalidate caches using utility function
      invalidateEntityCaches(
        queryClient,
        config.url,
        classUri,
        entityUri || currentEntityUri,
        affectedEntityUris,
      );

      if (!entityUri) {
        if (isRecording) {
          logEvent({ type: "entity_created", classUri, entityUri: currentEntityUri });
          logEvent({ type: "entity_saved", entityUri: currentEntityUri, classUri, isNew: true });
        }
        enqueueSnackbar(t("messages.entityCreated"), {
          variant: "success",
          autoHideDuration: 6000,
          action: (key) => (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                closeSnackbar(key);
                onCreateAnother();
              }}
            >
              {t("common:buttons.createAnother", { ns: "common" })}
            </Button>
          ),
        });
        onSaveSuccess({ isNew: true, savedEntityUri: currentEntityUri });
      } else {
        if (isRecording) {
          logEvent({ type: "entity_saved", entityUri, classUri, isNew: false });
        }
        enqueueSnackbar(t("messages.entitySaved"), {
          variant: "success",
          autoHideDuration: 3000,
        });
        onSaveSuccess({ isNew: false, savedEntityUri: entityUri });
      }
    } catch (error) {
      setSaveError(formatMutationError(error));
    } finally {
      setSaving(false);
    }
  }, [
    classUri,
    config,
    entityUri,
    customEntityUri,
    entityData,
    entityLabels,
    objectPropertyUris,
    properties,
    queryClient,
    enqueueSnackbar,
    t,
    isRecording,
    logEvent,
    onSaveSuccess,
    onCreateAnother,
    closeSnackbar,
    formatMutationError,
    i18n.language,
  ]);

  const handleDelete = useCallback(async () => {
    if (!entityUri) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const client = new SparqlClient(config);

      // First, find all related entities before deletion so we can invalidate their caches
      const findRelatedQuery = `
        SELECT DISTINCT ?relatedEntity WHERE {
          {
            <${sanitizeSparqlUri(entityUri)}> ?p ?relatedEntity .
            FILTER (isIRI(?relatedEntity))
          }
          UNION
          {
            ?relatedEntity ?p2 <${sanitizeSparqlUri(entityUri)}> .
          }
        }
      `;
      const relatedEntities = await client.query(findRelatedQuery);
      const affectedEntityUris = new Set<string>();
      relatedEntities.results.bindings.forEach((binding) => {
        if (binding.relatedEntity?.value) {
          affectedEntityUris.add(binding.relatedEntity.value);
        }
      });

      // One request: RDF-star annotations on both outgoing and incoming
      // triples, then the triples themselves. Sent together so a failure
      // cannot leave annotations pointing at statements that are gone.
      const sanitizedUri = sanitizeSparqlUri(entityUri);
      const deleteQuery = [
        `DELETE {
          << <${sanitizedUri}> ?p ?o >> ?annotationProperty ?annotationValue .
        } WHERE {
          << <${sanitizedUri}> ?p ?o >> ?annotationProperty ?annotationValue .
        }`,
        `DELETE {
          << ?s ?p2 <${sanitizedUri}> >> ?annotationProperty ?annotationValue .
        } WHERE {
          << ?s ?p2 <${sanitizedUri}> >> ?annotationProperty ?annotationValue .
        }`,
        `DELETE {
          <${sanitizedUri}> ?p ?o .
          ?s ?p2 <${sanitizedUri}> .
        } WHERE {
          { <${sanitizedUri}> ?p ?o . }
          UNION
          { ?s ?p2 <${sanitizedUri}> . }
        }`,
      ].join(" ;\n");
      await client.update(deleteQuery);

      invalidateEntityCaches(
        queryClient,
        config.url,
        classUri,
        undefined,
        affectedEntityUris,
      );

      if (isRecording) {
        logEvent({ type: "entity_deleted", entityUri, classUri });
      }

      enqueueSnackbar(t("messages.entityDeleted"), {
        variant: "success",
        autoHideDuration: 3000,
      });

      onDeleteSuccess();
    } catch (error) {
      setDeleteError(formatMutationError(error));
    } finally {
      setDeleting(false);
    }
  }, [
    entityUri,
    config,
    classUri,
    queryClient,
    enqueueSnackbar,
    t,
    isRecording,
    logEvent,
    onDeleteSuccess,
    formatMutationError,
  ]);

  const clearSaveError = useCallback(() => setSaveError(null), []);
  const clearDeleteError = useCallback(() => setDeleteError(null), []);

  return {
    handleSave,
    handleDelete,
    saving,
    deleting,
    saveError,
    deleteError,
    clearSaveError,
    clearDeleteError,
  };
}

/**
 * Returns the label and type labels of `uri` if it already has outgoing
 * statements, or null if the identifier is free. Only explicit statements
 * count, so a URI that is merely referenced by other entities is free.
 */
async function findExistingEntity(
  client: SparqlClient,
  uri: string,
  language: string,
): Promise<{ label: string; types: string } | null> {
  const sanitizedUri = sanitizeSparqlUri(uri);
  const lang = escapeSparqlLiteral(language);
  const response = await client.queryWithoutInference(`
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT (COUNT(?p) AS ?count) (SAMPLE(?label) AS ?anyLabel)
           (GROUP_CONCAT(DISTINCT ?typeLabel; SEPARATOR=", ") AS ?types)
    FROM <http://www.ontotext.com/explicit>
    WHERE {
      <${sanitizedUri}> ?p ?o .
      OPTIONAL { <${sanitizedUri}> rdfs:label ?label }
      OPTIONAL {
        <${sanitizedUri}> a ?type .
        OPTIONAL { ?type rdfs:label ?typeLabelLang FILTER(LANGMATCHES(LANG(?typeLabelLang), "${lang}")) }
        BIND(COALESCE(STR(?typeLabelLang), STR(?type)) AS ?typeLabel)
      }
    }
  `);
  const row = response.results.bindings[0];
  if (!row || parseInt(row.count?.value ?? "0", 10) === 0) return null;
  return { label: row.anyLabel?.value ?? uri, types: row.types?.value ?? "" };
}

/** Human-readable name of a property, for messages. */
function propertyLabel(properties: RdfProperty[], uri: string): string {
  const property = properties.find((p) => p.uri === uri);
  return formatLabel(property?.label, uri);
}
