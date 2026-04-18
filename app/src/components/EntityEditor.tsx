import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Paper,
  TextField,
  Box,
  CircularProgress,
  Skeleton,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
  Tooltip,
  IconButton,
  Button
} from "@mui/material";
import { ContentCopy, DeleteForever, Lock } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig, RdfProperty, OrderedValue } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { getGraphVisualizationUrl } from "../utils/graphUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useWEMIProperties,
  useAgentProperties,
  useRelatedWorkProperties,
  useRelatedExpressionProperties,
  useRelatedManifestationProperties
} from "../hooks/useRelationshipQueries";
import LabelManager from "./LabelManager";
import TurtleExportDialog from "./TurtleExportDialog";
import EntityEditorHeader from "./EntityEditorHeader";
import DataPropertiesSection from "./DataPropertiesSection";
import ObjectPropertyGroup from "./ObjectPropertyGroup";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { escapeSparqlLiteral, isValidUri, formatLabel, sanitizeSparqlUri } from "../utils/labelUtils";
import { useLogging } from "../hooks/useLogging";
import { useTurtleExportQuery } from "../hooks/useTurtleExportQuery";
import { EntityLabelsProvider, useEntityLabels, type EntityLabelsMap } from "../hooks/useEntityLabels";

// Stable empty map reference to avoid re-rendering context consumers while the
// batched labels query is in flight or returns no URIs.
const EMPTY_ENTITY_LABELS: EntityLabelsMap = new Map();

interface EntityEditorProps {
  config: SparqlEndpointConfig;
  classUri: string;
  className: string | null;
  entityUri: string | null;
  properties: RdfProperty[];
  objectProperties: RdfProperty[];
  propertiesLoading: boolean;
  objectPropertiesLoading: boolean;
  selectedLanguage: string;
  warnAutoUri: boolean;
  warnAutoLabel: boolean;
  onEntitySaved: () => void;
  onEntityDeselected?: () => void;
  onEditingChange?: (isEditing: boolean) => void;
  onRegisterSave?: (handler: (() => Promise<void>) | null) => void;
  onRegisterDiscard?: (handler: (() => void) | null) => void;
}

const EntityEditor: React.FC<EntityEditorProps> = ({
  config,
  classUri,
  className,
  entityUri,
  properties,
  objectProperties,
  propertiesLoading,
  objectPropertiesLoading,
  selectedLanguage,
  warnAutoUri,
  warnAutoLabel,
  onEntitySaved,
  onEntityDeselected,
  onEditingChange,
  onRegisterSave,
  onRegisterDiscard,
}) => {
  const { t } = useTranslation("entityEditor");
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { logEvent, isRecording } = useLogging();

  // Fetch properties for the specialized sections
  const { data: wemiProperties = [], isLoading: wemiPropertiesLoading } =
    useWEMIProperties(config, classUri, selectedLanguage);
  const { data: agentProperties = [], isLoading: agentPropertiesLoading } =
    useAgentProperties(config, classUri, selectedLanguage);
  const { data: relatedWorkProperties = [], isLoading: relatedWorkPropertiesLoading } =
    useRelatedWorkProperties(config, classUri, selectedLanguage);
  const { data: relatedExpressionProperties = [], isLoading: relatedExpressionPropertiesLoading } =
    useRelatedExpressionProperties(config, classUri, selectedLanguage);
  const { data: relatedManifestationProperties = [], isLoading: relatedManifestationPropertiesLoading } =
    useRelatedManifestationProperties(config, classUri, selectedLanguage);

  const [entityData, setEntityData] = useState<Record<string, OrderedValue[]>>({});
  const [isEditing, setIsEditing] = useState(!entityUri);
  // isDirty tracks actual user changes (separate from isEditing which controls form interactivity)
  // For new entities isEditing starts true but isDirty only becomes true after the user makes a change
  const [isDirty, setIsDirty] = useState(false);

  // Notify parent whenever dirty state changes (not edit mode, since new entities start in edit mode)
  useEffect(() => {
    onEditingChange?.(isDirty);
  }, [isDirty, onEditingChange]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [customEntityUri, setCustomEntityUri] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [saveWarningDialogOpen, setSaveWarningDialogOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [turtleDialogOpen, setTurtleDialogOpen] = useState(false);
  const [entityLabels, setEntityLabels] = useState<
    Array<{ id: string; value: string; language: string }>
  >([]);

  // Reset form when entity type (classUri) changes
  useEffect(() => {
    if (!entityUri) {
      // Only reset for new entity creation
      setEntityData({});
      setCustomEntityUri("");
      setSelectedProperty("");
      setSaveError(null);
      setIsEditing(true);
      setIsDirty(false);
      setEntityLabels([]);
    }
  }, [classUri, entityUri]);

  // Reset form after successful save of new entity
  const resetCreateForm = () => {
    setEntityData({});
    setCustomEntityUri("");
    setSelectedProperty("");
    setSaveError(null);
    setIsEditing(true);
    setIsDirty(false);
    setEntityLabels([]);
  };

  const { data: existingEntity, isLoading: entityLoading } = useQuery({
    queryKey: ["entity", config.url, entityUri],
    queryFn: async () => {
      if (!entityUri) return null;

      const client = new SparqlClient(config);
      const sanitizedUri = sanitizeSparqlUri(entityUri!);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        SELECT DISTINCT ?property ?value ?valueOrder WHERE {
          <${sanitizedUri}> ?property ?value .
          OPTIONAL {
            << <${sanitizedUri}> ?property ?value >> entedit:valueOrder ?valueOrder .
          }
          FILTER NOT EXISTS {
            <${sanitizedUri}> ?subProperty ?value .
            ?subProperty rdfs:subPropertyOf+ ?property .
            FILTER (?subProperty != ?property)
          }
        }
        ORDER BY ?property ?valueOrder
      `;

      const response = await client.query(query);
      const data: Record<string, OrderedValue[]> = {};

      const labels: Array<{ id: string; value: string; language: string }> = [];

      // Track per-property auto-increment for values without explicit order
      const propertyCounters: Record<string, number> = {};

      response.results.bindings.forEach((binding) => {
        const property = binding.property.value;
        const value = binding.value.value;

        // Extract language from rdfs:label if available
        if (property === "http://www.w3.org/2000/01/rdf-schema#label") {
          const language = binding.value["xml:lang"] || "";
          labels.push({
            id: `label-${labels.length}`,
            value: value,
            language: language,
          });
        } else {
          // Non-label properties
          if (!data[property]) {
            data[property] = [];
            propertyCounters[property] = 0;
          }
          const explicitOrder = binding.valueOrder?.value
            ? parseInt(binding.valueOrder.value, 10)
            : undefined;
          const order = explicitOrder ?? propertyCounters[property];
          propertyCounters[property] = Math.max(propertyCounters[property], order) + 1;
          const isUri = binding.value.type === "uri";
          data[property].push({ value, order, isUri });
        }
      });

      // Sort values within each property by order
      Object.values(data).forEach((values) => {
        values.sort((a, b) => a.order - b.order);
      });

      return { data, labels };
    },
    enabled: !!entityUri && !!config.url,
  });

  useEffect(() => {
    if (existingEntity) {
      // Don't overwrite in-progress edits when cache invalidation refreshes the data
      if (isEditing && isDirty) return;
      setEntityData(existingEntity.data);
      setIsEditing(false);
      setIsDirty(false);
      setEntityLabels(existingEntity.labels || []);
    } else if (!entityUri) {
      setEntityData({});
      setIsEditing(true);
      setIsDirty(false);
      setCustomEntityUri(""); // Clear custom URI for new entities
      setEntityLabels([]);
    }
    // Note: isEditing and isDirty are intentionally excluded from deps —
    // we only want to re-sync when the server data or selected entity changes,
    // not when the user toggles editing mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEntity, entityUri]);

  // Section configurations for the object property groups
  const objectPropertySections = useMemo(() => [
    {
      key: "controlled",
      sectionTitleKey: "sections.controlledValues",
      addLabelKey: "common:labels.addCategory",
      selectorPromptKey: "messages.selectEntity",
      properties: objectProperties,
      statusFilter: "controlled property",
    },
    {
      key: "agents",
      sectionTitleKey: "sections.relatedAgents",
      addLabelKey: "common:labels.addAgent",
      selectorPromptKey: "messages.selectRelatedAgent",
      properties: agentProperties,
      statusFilter: "object property",
    },
    {
      key: "wemi",
      sectionTitleKey: "sections.wemiRelationships",
      addLabelKey: "common:labels.addWEMI",
      selectorPromptKey: "messages.selectWEMIEntity",
      properties: wemiProperties,
      statusFilter: "core wemi property",
    },
    {
      key: "relatedWorks",
      sectionTitleKey: "sections.relatedWorks",
      addLabelKey: "common:labels.addRelatedWork",
      selectorPromptKey: "messages.selectRelatedWork",
      properties: relatedWorkProperties,
      statusFilter: "object property",
    },
    {
      key: "relatedExpressions",
      sectionTitleKey: "sections.relatedExpressions",
      addLabelKey: "common:labels.addRelatedExpression",
      selectorPromptKey: "messages.selectRelatedExpression",
      properties: relatedExpressionProperties,
      statusFilter: "object property",
    },
    {
      key: "relatedManifestations",
      sectionTitleKey: "sections.relatedManifestations",
      addLabelKey: "common:labels.addRelatedManifestation",
      selectorPromptKey: "messages.selectRelatedManifestation",
      properties: relatedManifestationProperties,
      statusFilter: "object property",
    },
  ], [objectProperties, agentProperties, wemiProperties, relatedWorkProperties, relatedExpressionProperties, relatedManifestationProperties]);

  // Set of all object property URIs — used to distinguish object vs data properties when serializing
  const objectPropertyUris = useMemo(() => {
    const uris = new Set<string>();
    objectPropertySections.forEach((section) =>
      section.properties.forEach((p) => uris.add(p.uri)),
    );
    return uris;
  }, [objectPropertySections]);

  // Collect all URI-typed object property values so we can batch-fetch their
  // rdfs:label in a single SPARQL query instead of firing one query per value
  // (the old pattern in ObjectPropertyValue). The resolved map is provided
  // through EntityLabelsProvider and consumed by ObjectPropertyValue.
  const relatedEntityUris = useMemo(() => {
    const uris: string[] = [];
    for (const [property, values] of Object.entries(entityData)) {
      const isObjectProp = objectPropertyUris.has(property);
      for (const v of values) {
        if ((isObjectProp || v.isUri) && v.value) uris.push(v.value);
      }
    }
    return uris;
  }, [entityData, objectPropertyUris]);

  const { data: relatedEntityLabels } = useEntityLabels(
    config,
    relatedEntityUris,
    selectedLanguage,
  );

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
              <${sanitizeSparqlUri(entityUri!)}> ?p ?relatedEntity .
              FILTER (isIRI(?relatedEntity))
            }
            UNION
            {
              ?relatedEntity ?p2 <${sanitizeSparqlUri(entityUri!)}> .
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
      const triples = [`<${sanitizedEntityUri}> a <${sanitizeSparqlUri(classUri)}> .`];
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
          ? (entityData[primaryProperty.uri] || []).find((v) => v.value.trim() && !v.isUri)?.value.trim()
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
        const sanitizedUri = sanitizeSparqlUri(entityUri!);

        // Managed properties: rdf:type, rdfs:label, all data properties, all object properties
        const managedPropertyUris = new Set<string>();
        managedPropertyUris.add("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
        managedPropertyUris.add("http://www.w3.org/2000/01/rdf-schema#label");
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
        const oldData = existingEntity?.data ?? {};
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

      // If this was a new entity, reset the create form
      if (!entityUri) {
        if (isRecording) {
          logEvent({ type: "entity_created", classUri, entityUri: currentEntityUri });
          logEvent({ type: "entity_saved", entityUri: currentEntityUri, classUri, isNew: true });
        }
        resetCreateForm();
        enqueueSnackbar(t("messages.entityCreated"), { variant: "success", autoHideDuration: 3000 });
      } else {
        if (isRecording) {
          logEvent({ type: "entity_saved", entityUri, classUri, isNew: false });
        }
        setIsEditing(false);
        setIsDirty(false);
        enqueueSnackbar(t("messages.entitySaved"), { variant: "success", autoHideDuration: 3000 });
      }

      onEntitySaved();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [classUri, config, entityUri, customEntityUri, entityData, entityLabels, existingEntity, objectPropertyUris, properties, queryClient, onEntitySaved]);

  const requestSave = useCallback(() => {
    // Only check warnings for new entities (existing entities already have URIs and labels)
    if (!entityUri) {
      const willAutoUri = warnAutoUri && !customEntityUri.trim();
      const willAutoLabel = warnAutoLabel && !entityLabels.some((l) => l.value.trim());
      if (willAutoUri || willAutoLabel) {
        setSaveWarningDialogOpen(true);
        return;
      }
    }
    handleSave();
  }, [entityUri, warnAutoUri, warnAutoLabel, customEntityUri, entityLabels, handleSave]);

  // Register/unregister handleSave with the parent so the header Refresh
  // button can offer a "Save & refresh" option when there are unsaved edits.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(isDirty ? handleSave : null);
    return () => onRegisterSave(null);
  }, [isDirty, handleSave, onRegisterSave]);

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
            <${sanitizeSparqlUri(entityUri!)}> ?p ?relatedEntity .
            FILTER (isIRI(?relatedEntity))
          }
          UNION
          {
            ?relatedEntity ?p2 <${sanitizeSparqlUri(entityUri!)}> .
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
      const sanitizedUri = sanitizeSparqlUri(entityUri!);
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

      // Invalidate caches using utility function
      invalidateEntityCaches(
        queryClient,
        config.url,
        classUri,
        undefined,
        affectedEntityUris,
      );

      // Close dialog and clear the entity selection
      setDeleteDialogOpen(false);

      if (isRecording) {
        logEvent({ type: "entity_deleted", entityUri, classUri });
      }

      // Show success notification
      enqueueSnackbar(t("messages.entityDeleted"), { variant: "success", autoHideDuration: 3000 });

      // Deselect the entity to show the "Create New Entity" form
      if (onEntityDeselected) {
        onEntityDeselected();
      }

      // Trigger a refresh of the entity list
      onEntitySaved();
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [entityUri, config, classUri, queryClient, onEntityDeselected, onEntitySaved]);

  const getGraphUrl = useMemo(
    () => entityUri ? getGraphVisualizationUrl(config.url, entityUri) : null,
    [entityUri, config.url]
  );

  const handleOpenGraph = useCallback((event: React.MouseEvent) => {
    // If user is holding Ctrl/Cmd, let the default link behavior work
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();

    if (!getGraphUrl) return;

    // Open in new tab with security attributes
    window.open(getGraphUrl, "_blank", "noopener,noreferrer");
  }, [getGraphUrl]);

  const getPropertyLabel = useCallback((propertyUri: string) => {
    const property = properties.find((p) => p.uri === propertyUri);
    return formatLabel(property?.label, propertyUri);
  }, [properties]);

  const handleLabelsSave = useCallback((
    labels: Array<{ id: string; value: string; language: string }>,
  ) => {
    setEntityLabels(labels);
    setLabelManagerOpen(false);
    setIsEditing(true); // Ensure form is in edit mode
    setIsDirty(true);   // Mark entity as having unsaved changes
  }, []);

  const addProperty = useCallback((propertyUri: string) => {
    if (propertyUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[propertyUri] || [];
        const maxOrder = currentValues.length > 0
          ? Math.max(...currentValues.map((v) => v.order)) + 1
          : 0;
        return {
          ...prev,
          [propertyUri]: [...currentValues, { value: "", order: maxOrder }],
        };
      });
      setIsDirty(true);
    }
  }, [isEditing]);

  const addObjectProperty = useCallback((propertyUri: string, entityUri: string) => {
    if (propertyUri && entityUri) {
      setEntityData((prev) => {
        const currentValues = prev[propertyUri] || [];
        const maxOrder = currentValues.length > 0
          ? Math.max(...currentValues.map((v) => v.order)) + 1
          : 0;
        return {
          ...prev,
          [propertyUri]: [...currentValues, { value: entityUri, order: maxOrder, isUri: true }],
        };
      });
      setIsDirty(true);
    }
  }, []);

  const updatePropertyValue = useCallback((
    property: string,
    index: number,
    value: string,
  ) => {
    setEntityData((prev) => {
      const values = [...(prev[property] || [])];
      values[index] = { ...values[index], value };
      return {
        ...prev,
        [property]: values,
      };
    });
    setIsDirty(true);
  }, []);

  const removePropertyValue = useCallback((property: string, index: number) => {
    setEntityData((prev) => {
      const values = prev[property] || [];
      const newValues = values.filter((_, i) => i !== index);
      if (newValues.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [property]: _, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [property]: newValues,
        };
      }
    });
    setIsDirty(true);
  }, []);

  const reorderPropertyValues = useCallback((property: string, fromIndex: number, toIndex: number) => {
    setEntityData((prev) => {
      const values = [...(prev[property] || [])];
      const [moved] = values.splice(fromIndex, 1);
      values.splice(toIndex, 0, moved);
      // Re-assign sequential order values
      const reordered = values.map((v, i) => ({ ...v, order: i }));
      return {
        ...prev,
        [property]: reordered,
      };
    });
    setIsDirty(true);
  }, []);

  const uriError = useMemo(() => {
    return customEntityUri && !isValidUri(customEntityUri);
  }, [customEntityUri]);

  // Primary label for the header and delete confirmation dialog
  const primaryEntityLabel = useMemo(() => {
    if (!entityLabels.length) return null;
    const langMatch = entityLabels.find((l) => l.language === selectedLanguage);
    if (langMatch) return langMatch.value;
    const noLangMatch = entityLabels.find((l) => l.language === "");
    if (noLangMatch) return noLangMatch.value;
    return entityLabels[0].value;
  }, [entityLabels, selectedLanguage]);

  const entityDisplayName = primaryEntityLabel || entityUri || "";

  // Ctrl/Cmd+S keyboard shortcut to save while editing
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        requestSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, requestSave]);

  // Additional handlers for the header component
  const handleEdit = useCallback(() => setIsEditing(true), []);

  const performCancel = useCallback(() => {
    setIsEditing(false);
    setIsDirty(false);
    setEntityData(existingEntity?.data || {});
    setEntityLabels(existingEntity?.labels || []);
    setDiscardDialogOpen(false);
  }, [existingEntity]);

  // Register/unregister discard handler so the header Refresh button's
  // "Discard & refresh" option can drop unsaved edits before invalidation.
  useEffect(() => {
    if (!onRegisterDiscard) return;
    onRegisterDiscard(isDirty ? performCancel : null);
    return () => onRegisterDiscard(null);
  }, [isDirty, performCancel, onRegisterDiscard]);

  const handleCancel = useCallback(() => {
    const dataChanged =
      JSON.stringify(entityData) !==
      JSON.stringify(existingEntity?.data ?? {});
    const labelsChanged =
      JSON.stringify(
        entityLabels.map((l) => ({ value: l.value, language: l.language })),
      ) !==
      JSON.stringify(
        (existingEntity?.labels ?? []).map((l) => ({
          value: l.value,
          language: l.language,
        })),
      );
    if (dataChanged || labelsChanged) {
      setDiscardDialogOpen(true);
    } else {
      performCancel();
    }
  }, [entityData, entityLabels, existingEntity, performCancel]);
  const handleDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);
  const handleNew = useCallback(() => onEntityDeselected?.(), [onEntityDeselected]);
  const handleEditLabels = useCallback(() => setLabelManagerOpen(true), []);
  const [uriDialogOpen, setUriDialogOpen] = useState(false);
  const handleEditUri = useCallback(() => setUriDialogOpen(true), []);

  // Turtle export
  const { turtle, isLoading: turtleLoading, error: turtleError, refetch: fetchTurtle } = useTurtleExportQuery(config, entityUri);
  const handleExportTurtle = useCallback(() => {
    setTurtleDialogOpen(true);
    void fetchTurtle();
  }, [fetchTurtle]);

  const handlePropertySelect = useCallback((propertyUri: string) => {
    addProperty(propertyUri);
    setSelectedProperty("");
  }, [addProperty]);

  const isLoadingAny =
    entityLoading ||
    propertiesLoading ||
    objectPropertiesLoading ||
    wemiPropertiesLoading ||
    agentPropertiesLoading ||
    relatedWorkPropertiesLoading ||
    relatedExpressionPropertiesLoading ||
    relatedManifestationPropertiesLoading;

  if (isLoadingAny) {
    return (
      <Paper
        elevation={1}
        sx={{ height: { xs: "auto", md: "100%" }, display: "flex", flexDirection: "column" }}
      >
        {/* Skeleton header row */}
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", display: "flex", gap: 1 }}>
          <Skeleton variant="rounded" width={80} height={32} />
          <Skeleton variant="rounded" width={80} height={32} />
          <Skeleton variant="rounded" width={80} height={32} />
        </Box>
        {/* Skeleton body */}
        <Box sx={{ p: 3, flex: 1 }}>
          {/* URI row */}
          <Skeleton variant="rounded" height={38} sx={{ mb: 2 }} />
          {/* Section header */}
          <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
          {/* Three property rows */}
          <Skeleton variant="rounded" height={40} sx={{ mb: 1.5 }} />
          <Skeleton variant="rounded" height={40} sx={{ mb: 1.5 }} />
          <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
          <Divider sx={{ my: 1.5 }} />
          {/* Second section header */}
          <Skeleton variant="text" width="35%" sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={40} sx={{ mb: 1.5 }} />
          <Skeleton variant="rounded" height={40} />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ height: { xs: "auto", md: "100%" }, display: "flex", flexDirection: "column" }}>
      <EntityEditorHeader
        entityUri={entityUri}
        entityLabel={primaryEntityLabel}
        className={className}
        isEditing={isEditing}
        saving={saving}
        uriError={!!uriError}
        classUri={classUri}
        graphUrl={getGraphUrl}
        onSave={requestSave}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onDelete={handleDeleteDialog}
        onNew={handleNew}
        onOpenGraph={handleOpenGraph}
        onEditLabels={handleEditLabels}
        onEditUri={handleEditUri}
        onExportTurtle={handleExportTurtle}
        isDirty={isDirty}
      />

      <Box sx={{ p: 3, flex: 1, overflow: "auto" }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Tooltip
          title={!classUri ? t("messages.selectClass") : ""}
          followCursor
          disableHoverListener={!!classUri}
        >
          <Box>
            <Box
              sx={{
                opacity: classUri ? 1 : 0.45,
                pointerEvents: classUri ? "auto" : "none",
                transition: "opacity 0.2s",
              }}
            >
        <DataPropertiesSection
          entityData={entityData}
          properties={properties}
          isEditing={isEditing}
          classUri={classUri}
          selectedProperty={selectedProperty}
          onPropertySelect={handlePropertySelect}
          onUpdateValue={updatePropertyValue}
          onRemoveValue={removePropertyValue}
          onReorderValues={reorderPropertyValues}
          getPropertyLabel={getPropertyLabel}
        />

        <EntityLabelsProvider value={relatedEntityLabels ?? EMPTY_ENTITY_LABELS}>
          {objectPropertySections.map((section) => (
            <ObjectPropertyGroup
              key={section.key}
              config={config}
              sectionTitle={t(section.sectionTitleKey)}
              sectionKey={section.key}
              entityUri={entityUri}
              addLabel={t(section.addLabelKey, { ns: "common" })}
              selectorPromptLabel={t(section.selectorPromptKey)}
              properties={section.properties}
              statusFilter={section.statusFilter}
              entityData={entityData}
              isEditing={isEditing}
              classUri={classUri}
              selectedLanguage={selectedLanguage}
              onUpdateValue={updatePropertyValue}
              onRemoveValue={removePropertyValue}
              onReorderValues={reorderPropertyValues}
              onAddProperty={addObjectProperty}
            />
          ))}
        </EntityLabelsProvider>
            </Box>
          </Box>
        </Tooltip>
      </Box>

      {/* URI Dialog */}
      <Dialog
        open={uriDialogOpen}
        onClose={() => setUriDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("common:labels.identifier", { ns: "common" })}</DialogTitle>
        <DialogContent>
          {entityUri ? (
            <Box
              sx={{
                mt: 1,
                px: 1.25,
                py: 0.75,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                backgroundColor: "action.hover",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minHeight: 38,
              }}
            >
              <Lock sx={{ fontSize: "0.9rem", color: "text.disabled", flexShrink: 0 }} />
              <Typography
                variant="body2"
                sx={{ flex: 1, color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}
              >
                {entityUri}
              </Typography>
              <Tooltip title={t("tooltips.copyUri")}>
                <IconButton
                  size="small"
                  sx={{ p: 0.5 }}
                  aria-label={t("tooltips.copyUri")}
                  onClick={() =>
                    navigator.clipboard.writeText(entityUri).then(
                      () => enqueueSnackbar(t("messages.uriCopied"), { variant: "success", autoHideDuration: 2000 }),
                      () => enqueueSnackbar(t("messages.copyFailed"), { variant: "error" }),
                    )
                  }
                >
                  <ContentCopy sx={{ fontSize: "0.9rem" }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <TextField
              fullWidth
              autoFocus
              label={t("common:labels.identifier", { ns: "common" })}
              value={customEntityUri}
              onChange={(e) => setCustomEntityUri(e.target.value)}
              disabled={!isEditing}
              error={!!uriError}
              helperText={t("placeholders.enterUri")}
              sx={{ mt: 1 }}
              size="small"
              placeholder={t("placeholders.enterUri")}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUriDialogOpen(false)}>
            {t("common:buttons.close", { ns: "common" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Label Manager Dialog */}
      <LabelManager
        open={labelManagerOpen}
        onClose={() => setLabelManagerOpen(false)}
        onSave={handleLabelsSave}
        initialLabels={entityLabels}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">{t("dialogs.delete.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t("dialogs.delete.message")}
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontWeight: "bold" }}>
            {t("dialogs.delete.entityLabel", { entityName: entityDisplayName })}
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
          >
            {t("common:buttons.cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={
              deleting ? <CircularProgress size={16} /> : <DeleteForever />
            }
          >
            {deleting ? t("common:buttons.deleting", { ns: "common" }) : t("common:buttons.delete", { ns: "common" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Turtle Export Dialog */}
      <TurtleExportDialog
        open={turtleDialogOpen}
        onClose={() => setTurtleDialogOpen(false)}
        turtle={turtle}
        isLoading={turtleLoading}
        error={turtleError}
        entityUri={entityUri}
      />

      {/* Discard Changes Confirmation Dialog */}
      <Dialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        aria-labelledby="discard-dialog-title"
        aria-describedby="discard-dialog-description"
      >
        <DialogTitle id="discard-dialog-title">
          {t("dialogs.discard.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="discard-dialog-description">
            {t("dialogs.discard.message")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardDialogOpen(false)}>
            {t("common:buttons.cancel", { ns: "common" })}
          </Button>
          <Button onClick={performCancel} color="warning" variant="contained">
            {t("dialogs.discard.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Warning Dialog for auto-generated URI/label */}
      <Dialog
        open={saveWarningDialogOpen}
        onClose={() => setSaveWarningDialogOpen(false)}
        aria-labelledby="save-warning-dialog-title"
        aria-describedby="save-warning-dialog-description"
      >
        <DialogTitle id="save-warning-dialog-title">
          {t("dialogs.saveWarning.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="save-warning-dialog-description">
            {(() => {
              const willAutoUri = warnAutoUri && !entityUri && !customEntityUri.trim();
              const willAutoLabel = warnAutoLabel && !entityLabels.some((l) => l.value.trim());
              if (willAutoUri && willAutoLabel) return t("dialogs.saveWarning.messageBoth");
              if (willAutoUri) return t("dialogs.saveWarning.messageUri");
              return t("dialogs.saveWarning.messageLabel");
            })()}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveWarningDialogOpen(false)}>
            {t("common:buttons.cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={() => {
              setSaveWarningDialogOpen(false);
              handleSave();
            }}
            variant="contained"
          >
            {t("dialogs.saveWarning.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EntityEditor;
