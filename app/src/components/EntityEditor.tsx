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
import type { SparqlEndpointConfig, RdfProperty } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useWEMIProperties,
  useAgentProperties,
  useRelatedWorkProperties,
  useRelatedExpressionProperties,
  useRelatedManifestationProperties
} from "../hooks/useSparqlQueries";
import LabelManager from "./LabelManager";
import EntityEditorHeader from "./EntityEditorHeader";
import DataPropertiesSection from "./DataPropertiesSection";
import ObjectPropertyGroup from "./ObjectPropertyGroup";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { escapeSparqlLiteral, isValidUri, formatLabel, sanitizeSparqlUri } from "../utils/labelUtils";

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
  onEntitySaved: () => void;
  onEntityDeselected?: () => void;
  onEditingChange?: (isEditing: boolean) => void;
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
  onEntitySaved,
  onEntityDeselected,
  onEditingChange,
}) => {
  const { t } = useTranslation("entityEditor");
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

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

  const [entityData, setEntityData] = useState<Record<string, string[]>>({});
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
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
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
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        SELECT DISTINCT ?property ?value ?order WHERE {
          <${sanitizeSparqlUri(entityUri!)}> ?property ?value .
          OPTIONAL{
            ?property entedit:order ?order 
          }
          FILTER NOT EXISTS {
            <${sanitizeSparqlUri(entityUri!)}> ?subProperty ?value .
            ?subProperty rdfs:subPropertyOf+ ?property .
            FILTER (?subProperty != ?property)
          }
        }
        ORDER BY ?property
      `;

      const response = await client.query(query);
      const data: Record<string, string[]> = {};

      const labels: Array<{ id: string; value: string; language: string }> = [];

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
          }
          data[property].push(value);
        }
      });

      return { data, labels };
    },
    enabled: !!entityUri && !!config.url,
  });

  useEffect(() => {
    if (existingEntity) {
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
  }, [existingEntity, entityUri]);

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
          values.forEach((value) => {
            if (value.trim()) affectedEntityUris.add(value);
          });
        }
      });

      const triples = [`<${sanitizeSparqlUri(currentEntityUri)}> a <${sanitizeSparqlUri(classUri)}> .`];

      // Add labels from the label manager
      entityLabels.forEach((label) => {
        if (label.value.trim()) {
          const escapedValue = escapeSparqlLiteral(label.value);
          const formattedValue = label.language
            ? `"${escapedValue}"@${label.language}`
            : `"${escapedValue}"`;
          const labelTriple = `<${sanitizeSparqlUri(currentEntityUri)}> <http://www.w3.org/2000/01/rdf-schema#label> ${formattedValue} .`;
          triples.push(labelTriple);
        }
      });

      Object.entries(entityData).forEach(([property, values]) => {
        values.forEach((value) => {
          if (value.trim()) {
            if (objectPropertyUris.has(property)) {
              triples.push(
                `<${sanitizeSparqlUri(currentEntityUri)}> <${sanitizeSparqlUri(property)}> <${sanitizeSparqlUri(value)}> .`,
              );
            } else {
              const escapedValue = escapeSparqlLiteral(value);
              triples.push(
                `<${sanitizeSparqlUri(currentEntityUri)}> <${sanitizeSparqlUri(property)}> "${escapedValue}" .`,
              );
            }
          }
        });
      });

      const insertQuery = `
        INSERT DATA {
          ${triples.join("\n          ")}
        }
      `;

      if (entityUri) {
        // For existing entities, we should delete old triples first
        // Delete both outgoing and incoming statements to handle inverse properties
        const deleteQuery = `
          DELETE {
            <${sanitizeSparqlUri(entityUri!)}> ?p ?o .
            ?s ?p2 <${sanitizeSparqlUri(entityUri!)}> .
          }
          WHERE {
            {
              <${sanitizeSparqlUri(entityUri!)}> ?p ?o .
            }
            UNION
            {
              ?s ?p2 <${sanitizeSparqlUri(entityUri!)}> .
            }
          }
        `;
        await client.update(deleteQuery);
      }

      await client.update(insertQuery);

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
        resetCreateForm();
        enqueueSnackbar(t("messages.entityCreated"), { variant: "success", autoHideDuration: 3000 });
      } else {
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
  }, [classUri, config, entityUri, customEntityUri, entityData, entityLabels, queryClient, onEntitySaved]);

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

      // Delete both outgoing statements and incoming statements (inverse properties)
      const deleteQuery = `
        DELETE {
          <${sanitizeSparqlUri(entityUri!)}> ?p ?o .
          ?s ?p2 <${sanitizeSparqlUri(entityUri!)}> .
        }
        WHERE {
          {
            <${sanitizeSparqlUri(entityUri!)}> ?p ?o .
          }
          UNION
          {
            ?s ?p2 <${sanitizeSparqlUri(entityUri!)}> .
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

  const getGraphUrl = useMemo((): string | null => {
    if (!entityUri) return null;

    try {
      // Derive visualization base URI from SPARQL endpoint URL
      const url = new URL(config.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Encode the URI for the query parameter
      const encodedUri = encodeURIComponent(entityUri);
      return `${baseUrl}/graphs-visualizations?uri=${encodedUri}`;
    } catch (error) {
      console.error("Failed to generate graph URL:", error);
      return null;
    }
  }, [entityUri, config.url]);

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
        return {
          ...prev,
          [propertyUri]: [...currentValues, ""],
        };
      });
      setIsDirty(true);
    }
  }, [isEditing]);

  const addObjectProperty = useCallback((propertyUri: string, entityUri: string) => {
    if (propertyUri && entityUri) {
      setEntityData((prev) => ({
        ...prev,
        [propertyUri]: [...(prev[propertyUri] || []), entityUri],
      }));
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
      values[index] = value;
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
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

  // Additional handlers for the header component
  const handleEdit = useCallback(() => setIsEditing(true), []);

  const performCancel = useCallback(() => {
    setIsEditing(false);
    setIsDirty(false);
    setEntityData(existingEntity?.data || {});
    setEntityLabels(existingEntity?.labels || []);
    setDiscardDialogOpen(false);
  }, [existingEntity]);

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
        onSave={handleSave}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onDelete={handleDeleteDialog}
        onNew={handleNew}
        onOpenGraph={handleOpenGraph}
        onEditLabels={handleEditLabels}
      />

      <Box sx={{ p: 3, flex: 1, overflow: "auto" }}>
        {!classUri && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t("messages.selectClass")}
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        {entityUri ? (
          /* Existing entity — locked URI, read-only display with copy button */
          <Box
            sx={{
              mb: 2,
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
              noWrap
              sx={{ flex: 1, color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem" }}
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
          /* New entity — editable URI field */
          <TextField
            fullWidth
            label={t("common:labels.identifier", { ns: "common" })}
            value={customEntityUri}
            onChange={(e) => setCustomEntityUri(e.target.value)}
            disabled={!isEditing}
            error={!!uriError}
            sx={{
              mb: 2,
              "& .MuiInputBase-input": { fontSize: "0.875rem", py: 0.75 },
              "& .MuiInputLabel-outlined": { fontSize: "0.875rem" },
            }}
            size="small"
            placeholder={t("placeholders.enterUri")}
          />
        )}

        <DataPropertiesSection
          entityData={entityData}
          properties={properties}
          isEditing={isEditing}
          classUri={classUri}
          selectedProperty={selectedProperty}
          onPropertySelect={handlePropertySelect}
          onUpdateValue={updatePropertyValue}
          onRemoveValue={removePropertyValue}
          getPropertyLabel={getPropertyLabel}
        />

        {objectPropertySections.map((section) => (
          <ObjectPropertyGroup
            key={section.key}
            config={config}
            sectionTitle={t(section.sectionTitleKey)}
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
            onAddProperty={addObjectProperty}
          />
        ))}
      </Box>

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
    </Paper>
  );
};

export default EntityEditor;
