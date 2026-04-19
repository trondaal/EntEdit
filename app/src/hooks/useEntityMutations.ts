import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type {
  SparqlEndpointConfig,
  RdfProperty,
  OrderedValue,
} from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import {
  escapeSparqlLiteral,
  sanitizeSparqlUri,
} from "../utils/labelUtils";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { useLogging } from "./useLogging";
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
}: UseEntityMutationsParams): UseEntityMutationsResult {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation("entityEditor");
  const { logEvent, isRecording } = useLogging();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        entityUri ||
        customEntityUri.trim() ||
        `http://example.org/entity-${Date.now()}`;

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

      const sanitizedEntityUri = sanitizeSparqlUri(currentEntityUri);
      const triples = [
        `<${sanitizedEntityUri}> a <${sanitizeSparqlUri(classUri)}> .`,
      ];
      const orderAnnotations: string[] = [];

      // Add labels from the label manager
      const hasUserLabel = entityLabels.some((l) => l.value.trim());
      entityLabels.forEach((label) => {
        if (label.value.trim()) {
          const escapedValue = escapeSparqlLiteral(label.value);
          const formattedValue = label.language
            ? `"${escapedValue}"@${label.language}`
            : `"${escapedValue}"`;
          const labelTriple = `<${sanitizedEntityUri}> <http://www.w3.org/2000/01/rdf-schema#label> ${formattedValue} .`;
          triples.push(labelTriple);
        }
      });

      // Fallback: if user has not provided any label, derive a default
      // (untagged) label from the value of the property with order 1.
      if (!hasUserLabel) {
        const primaryProperty = properties.find((p) => p.order === 1);
        const primaryValue = primaryProperty
          ? (entityData[primaryProperty.uri] || []).find(
              (v) => v.value.trim() && !v.isUri,
            )?.value.trim()
          : undefined;
        if (primaryValue) {
          const labelTriple = `<${sanitizedEntityUri}> <http://www.w3.org/2000/01/rdf-schema#label> "${escapeSparqlLiteral(primaryValue)}" .`;
          triples.push(labelTriple);
        }
      }

      Object.entries(entityData).forEach(([property, values]) => {
        const hasMultipleValues = values.filter(({ value }) => value.trim()).length > 1;
        values.forEach(({ value, order, isUri }) => {
          if (value.trim()) {
            const sanitizedProp = sanitizeSparqlUri(property);
            let objectValue: string;
            // Use isUri from the SPARQL binding type as fallback for properties
            // not in objectPropertyUris (e.g. untagged relationship properties)
            if (objectPropertyUris.has(property) || isUri) {
              objectValue = `<${sanitizeSparqlUri(value)}>`;
            } else {
              objectValue = `"${escapeSparqlLiteral(value)}"`;
            }
            triples.push(
              `<${sanitizedEntityUri}> <${sanitizedProp}> ${objectValue} .`,
            );
            // Add RDF-star order annotation when there are multiple values
            if (hasMultipleValues) {
              orderAnnotations.push(
                `<< <${sanitizedEntityUri}> <${sanitizedProp}> ${objectValue} >> <http://oslomet.no/abi/vocab#valueOrder> ${order} .`,
              );
            }
          }
        });
      });

      const allTriples = [...triples, ...orderAnnotations];
      const insertQuery = `
        INSERT DATA {
          ${allTriples.join("\n          ")}
        }
      `;

      if (entityUri) {
        // For existing entities, only delete properties that the editor manages.
        // Unmanaged properties (those without the correct entedit:status or
        // incoming-only triples from other entities) are left untouched.
        //
        // All delete + insert operations are combined into a single SPARQL Update
        // request (semicolon-separated) so GraphDB processes them atomically
        // within one transaction — preventing partial deletes on network failure.
        const sanitizedUri = sanitizeSparqlUri(entityUri);

        // Managed properties: rdf:type, rdfs:label, all data properties, all object properties
        const managedPropertyUris = new Set<string>();
        managedPropertyUris.add(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        );
        managedPropertyUris.add(
          "http://www.w3.org/2000/01/rdf-schema#label",
        );
        properties.forEach((p) => managedPropertyUris.add(p.uri));
        objectPropertyUris.forEach((uri) => managedPropertyUris.add(uri));

        const managedValues = [...managedPropertyUris]
          .map((uri) => `<${sanitizeSparqlUri(uri)}>`)
          .join(" ");

        const updateOperations: string[] = [];

        // 1. Delete RDF-star annotations on managed outgoing triples
        updateOperations.push(`
          DELETE {
            << <${sanitizedUri}> ?p ?o >> ?annotPred ?annotVal .
          }
          WHERE {
            << <${sanitizedUri}> ?p ?o >> ?annotPred ?annotVal .
            VALUES ?p { ${managedValues} }
          }
        `);

        // 2. Delete managed outgoing triples only
        updateOperations.push(`
          DELETE {
            <${sanitizedUri}> ?p ?o .
          }
          WHERE {
            <${sanitizedUri}> ?p ?o .
            VALUES ?p { ${managedValues} }
          }
        `);

        // 3. Handle inverse properties: find object property values that were
        // removed by the user and delete incoming triples from those entities.
        // This ensures that when a user removes a relationship that was stored
        // in the inverse direction, the asserted incoming triple is also cleaned up.
        // Read existingEntity from the ref so this logic doesn't drag the full
        // SPARQL result through handleSave's dependency array.
        const oldData = existingEntityRef.current?.data ?? {};
        const removedEntityUris = new Set<string>();
        for (const [prop, oldValues] of Object.entries(oldData)) {
          // Only check properties where values are URIs (object properties)
          if (!oldValues.some((v) => v.isUri)) continue;
          const newValues = new Set(
            (entityData[prop] || []).map((v) => v.value),
          );
          for (const ov of oldValues) {
            if (ov.isUri && ov.value && !newValues.has(ov.value)) {
              removedEntityUris.add(ov.value);
            }
          }
        }

        if (removedEntityUris.size > 0) {
          const removedUriValues = [...removedEntityUris]
            .map((uri) => `<${sanitizeSparqlUri(uri)}>`)
            .join(" ");
          updateOperations.push(`
            DELETE {
              ?s ?p <${sanitizedUri}> .
            }
            WHERE {
              ?s ?p <${sanitizedUri}> .
              VALUES ?s { ${removedUriValues} }
            }
          `);
        }

        // 4. Re-insert all current data
        updateOperations.push(insertQuery);

        // Send all operations as a single atomic request
        await client.update(updateOperations.join(" ;\n"));
      } else {
        // New entity: just insert
        await client.update(insertQuery);
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
          autoHideDuration: 3000,
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
      setSaveError((error as Error).message);
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

      // Delete RDF-star annotations first, then outgoing and incoming statements
      const sanitizedUri = sanitizeSparqlUri(entityUri);
      const deleteAnnotationsQuery = `
        DELETE WHERE {
          << <${sanitizedUri}> ?p ?o >> ?annotPred ?annotVal .
        }
      `;
      await client.update(deleteAnnotationsQuery);

      const deleteQuery = `
        DELETE {
          <${sanitizedUri}> ?p ?o .
          ?s ?p2 <${sanitizedUri}> .
        }
        WHERE {
          {
            <${sanitizedUri}> ?p ?o .
          }
          UNION
          {
            ?s ?p2 <${sanitizedUri}> .
          }
        }
      `;
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
      setDeleteError((error as Error).message);
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
