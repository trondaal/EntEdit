import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Paper,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
} from "@mui/material";
import { DeleteForever } from "@mui/icons-material";
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
import ObjectPropertySection from "./ObjectPropertySection";
import ObjectPropertySelector from "./ObjectPropertySelector";
import WEMIRelationshipSelector from "./WEMIRelationshipSelector";
import RelatedAgentsSelector from "./RelatedAgentsSelector";
import RelatedWorkSelector from "./RelatedWorkSelector";
import RelatedExpressionSelector from "./RelatedExpressionSelector";
import RelatedManifestationSelector from "./RelatedManifestationSelector";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { escapeSparqlLiteral, isValidUri, formatLabel } from "../utils/labelUtils";

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedControlledProperty, setSelectedControlledProperty] =
    useState<string>("");
  const [selectedWEMIProperty, setSelectedWEMIProperty] =
    useState<string>("");
  const [selectedAgentProperty, setSelectedAgentProperty] =
    useState<string>("");
  const [selectedRelatedWorkProperty, setSelectedRelatedWorkProperty] =
    useState<string>("");
  const [selectedRelatedExpressionProperty, setSelectedRelatedExpressionProperty] =
    useState<string>("");
  const [selectedRelatedManifestationProperty, setSelectedRelatedManifestationProperty] =
    useState<string>("");
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
      setSelectedControlledProperty("");
      setSelectedWEMIProperty("");
      setSelectedAgentProperty("");
      setSelectedRelatedWorkProperty("");
      setSelectedRelatedExpressionProperty("");
      setSelectedRelatedManifestationProperty("");
      setSaveError(null);
      setIsEditing(true);
      setEntityLabels([]);
    }
  }, [classUri, entityUri, selectedLanguage]);

  // Reset form after successful save of new entity
  const resetCreateForm = () => {
    setEntityData({});
    setCustomEntityUri("");
    setSelectedProperty("");
    setSelectedControlledProperty("");
    setSelectedWEMIProperty("");
    setSelectedAgentProperty("");
    setSelectedRelatedWorkProperty("");
    setSelectedRelatedExpressionProperty("");
    setSelectedRelatedManifestationProperty("");
    setSaveError(null);
    setIsEditing(true);
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
          <${entityUri}> ?property ?value .
          OPTIONAL{
            ?property entedit:order ?order 
          }
          FILTER NOT EXISTS {
            <${entityUri}> ?subProperty ?value .
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
      console.log("Loading existing entity:", existingEntity);
      setEntityData(existingEntity.data);
      setIsEditing(false);
      // Use detected language from the entity (could be empty string for no language)
      setEntityLabels(existingEntity.labels || []);
      console.log("Setting entity labels:", existingEntity.labels);
    } else if (!entityUri) {
      setEntityData({});
      setIsEditing(true);
      setCustomEntityUri(""); // Clear custom URI for new entities
      setEntityLabels([]);
    }
  }, [existingEntity, entityUri, selectedLanguage]);

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
              <${entityUri}> ?p ?relatedEntity .
              FILTER (isIRI(?relatedEntity))
            }
            UNION
            {
              ?relatedEntity ?p2 <${entityUri}> .
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

      // Also collect entity URIs from the new data being saved
      Object.entries(entityData).forEach(([, values]) => {
        values.forEach((value) => {
          if (value.trim() && value.startsWith("http")) {
            affectedEntityUris.add(value);
          }
        });
      });

      const triples = [`<${currentEntityUri}> a <${classUri}> .`];

      // Add labels from the label manager
      entityLabels.forEach((label) => {
        if (label.value.trim()) {
          const escapedValue = escapeSparqlLiteral(label.value);
          const formattedValue = label.language
            ? `"${escapedValue}"@${label.language}`
            : `"${escapedValue}"`;
          const labelTriple = `<${currentEntityUri}> <http://www.w3.org/2000/01/rdf-schema#label> ${formattedValue} .`;
          triples.push(labelTriple);
        }
      });

      Object.entries(entityData).forEach(([property, values]) => {
        values.forEach((value) => {
          if (value.trim()) {
            // Simple heuristic: if value looks like a URI, don't quote it
            if (value.startsWith("http")) {
              const formattedValue = `<${value}>`;
              triples.push(
                `<${currentEntityUri}> <${property}> ${formattedValue} .`,
              );
            } else {
              const escapedValue = escapeSparqlLiteral(value);
              const formattedValue = `"${escapedValue}"`;
              triples.push(
                `<${currentEntityUri}> <${property}> ${formattedValue} .`,
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
            <${entityUri}> ?p ?o .
            ?s ?p2 <${entityUri}> .
          }
          WHERE {
            {
              <${entityUri}> ?p ?o .
            }
            UNION
            {
              ?s ?p2 <${entityUri}> .
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
        enqueueSnackbar(t("messages.entityCreated"), { variant: "success" });
      } else {
        setIsEditing(false);
        enqueueSnackbar(t("messages.entitySaved"), { variant: "success" });
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
            <${entityUri}> ?p ?relatedEntity .
            FILTER (isIRI(?relatedEntity))
          }
          UNION
          {
            ?relatedEntity ?p2 <${entityUri}> .
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
          <${entityUri}> ?p ?o .
          ?s ?p2 <${entityUri}> .
        }
        WHERE {
          {
            <${entityUri}> ?p ?o .
          }
          UNION
          {
            ?s ?p2 <${entityUri}> .
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
      enqueueSnackbar(t("messages.entityDeleted"), { variant: "success" });

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

  const getObjectPropertyLabel = useCallback((propertyUri: string) => {
    // Search across all property arrays
    const property = objectProperties.find((p) => p.uri === propertyUri)
      || wemiProperties.find((p) => p.uri === propertyUri)
      || agentProperties.find((p) => p.uri === propertyUri)
      || relatedWorkProperties.find((p) => p.uri === propertyUri)
      || relatedExpressionProperties.find((p) => p.uri === propertyUri)
      || relatedManifestationProperties.find((p) => p.uri === propertyUri);
    return formatLabel(property?.label, propertyUri);
  }, [objectProperties, wemiProperties, agentProperties, relatedWorkProperties, relatedExpressionProperties, relatedManifestationProperties]);

  const handleLabelsSave = useCallback((
    labels: Array<{ id: string; value: string; language: string }>,
  ) => {
    setEntityLabels(labels);
    setLabelManagerOpen(false);
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
    }
  }, [isEditing]);

  const addControlledProperty = useCallback((selectedEntityUri: string) => {
    if (selectedControlledProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedControlledProperty] || [];
        return {
          ...prev,
          [selectedControlledProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedControlledProperty("");
    }
  }, [selectedControlledProperty, isEditing]);

  const addWEMIProperty = useCallback((selectedEntityUri: string) => {
    if (selectedWEMIProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedWEMIProperty] || [];
        return {
          ...prev,
          [selectedWEMIProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedWEMIProperty("");
    }
  }, [selectedWEMIProperty, isEditing]);

  const addAgentProperty = useCallback((selectedEntityUri: string) => {
    if (selectedAgentProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedAgentProperty] || [];
        return {
          ...prev,
          [selectedAgentProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedAgentProperty("");
    }
  }, [selectedAgentProperty, isEditing]);

  const addRelatedWorkProperty = useCallback((selectedEntityUri: string) => {
    if (selectedRelatedWorkProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedRelatedWorkProperty] || [];
        return {
          ...prev,
          [selectedRelatedWorkProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedRelatedWorkProperty("");
    }
  }, [selectedRelatedWorkProperty, isEditing]);

  const addRelatedExpressionProperty = useCallback((selectedEntityUri: string) => {
    if (selectedRelatedExpressionProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedRelatedExpressionProperty] || [];
        return {
          ...prev,
          [selectedRelatedExpressionProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedRelatedExpressionProperty("");
    }
  }, [selectedRelatedExpressionProperty, isEditing]);

  const addRelatedManifestationProperty = useCallback((selectedEntityUri: string) => {
    if (selectedRelatedManifestationProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedRelatedManifestationProperty] || [];
        return {
          ...prev,
          [selectedRelatedManifestationProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedRelatedManifestationProperty("");
    }
  }, [selectedRelatedManifestationProperty, isEditing]);

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
  }, []);

  // Get properties that have values, separated by type (memoized for performance)
  /*const objectPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isObjectProperty = objectProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isObjectProperty;
    });
  }, [entityData, objectProperties]);*/

  // Controlled properties are those with status "controlled property"
  const controlledPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isControlledProperty = objectProperties.some(
        (p) => p.uri === property && p.status === "controlled property",
      );
      return hasValues && isControlledProperty;
    });
  }, [entityData, objectProperties]);

  // Filter properties with values from the three specialized property sets
  const wemiPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isWEMIProperty = wemiProperties.some(
        (p) => p.uri === property && p.status === "core wemi property",
      );
      return hasValues && isWEMIProperty;
    });
  }, [entityData, wemiProperties]);

  const agentPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isAgentProperty = agentProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isAgentProperty;
    });
  }, [entityData, agentProperties]);

  const relatedWorkPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isRelatedWorkProperty = relatedWorkProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isRelatedWorkProperty;
    });
  }, [entityData, relatedWorkProperties]);

  const relatedExpressionPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isRelatedExpressionProperty = relatedExpressionProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isRelatedExpressionProperty;
    });
  }, [entityData, relatedExpressionProperties]);

  const relatedManifestationPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isRelatedManifestationProperty = relatedManifestationProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isRelatedManifestationProperty;
    });
  }, [entityData, relatedManifestationProperties]);

  // Get available properties for dropdown (excluding rdfs:label)
  /*const availableObjectProperties = useMemo(() => {
    return objectProperties.filter(
      (property) => property.status === "object property",
    );
  }, [objectProperties]);*/

  // Available controlled properties are those with status "controlled property"
  const availableControlledProperties = useMemo(() => {
    return objectProperties.filter(
      (property) => property.status === "controlled property",
    );
  }, [objectProperties]);

  // Available WEMI properties from dedicated hook
  const availableWEMIProperties = useMemo(() => {
    return wemiProperties.filter(
      (property) => property.status === "core wemi property",
    );
  }, [wemiProperties]);

  // Available agent properties from dedicated hook
  const availableAgentProperties = useMemo(() => {
    return agentProperties.filter(
      (property) => property.status === "object property",
    );
  }, [agentProperties]);

  // Available related work properties from dedicated hook
  const availableRelatedWorkProperties = useMemo(() => {
    return relatedWorkProperties.filter(
      (property) => property.status === "object property",
    );
  }, [relatedWorkProperties]);

  // Available related expression properties from dedicated hook
  const availableRelatedExpressionProperties = useMemo(() => {
    return relatedExpressionProperties.filter(
      (property) => property.status === "object property",
    );
  }, [relatedExpressionProperties]);

  // Available related manifestation properties from dedicated hook
  const availableRelatedManifestationProperties = useMemo(() => {
    return relatedManifestationProperties.filter(
      (property) => property.status === "object property",
    );
  }, [relatedManifestationProperties]);

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

  // Additional handlers for the header component
  const handleEdit = useCallback(() => setIsEditing(true), []);

  const performCancel = useCallback(() => {
    setIsEditing(false);
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

  if (
    entityLoading ||
    propertiesLoading ||
    objectPropertiesLoading ||
    wemiPropertiesLoading ||
    agentPropertiesLoading ||
    relatedWorkPropertiesLoading ||
    relatedExpressionPropertiesLoading ||
    relatedManifestationPropertiesLoading
  ) {
    return (
      <Paper
        elevation={1}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: { xs: "auto", md: "100%" },
        }}
      >
        <CircularProgress />
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

        <TextField
          fullWidth
          label={t("common:labels.identifier", { ns: "common" })}
          value={entityUri || customEntityUri}
          onChange={(e) => {
            if (!entityUri) {
              // Only allow editing for new entities
              setCustomEntityUri(e.target.value);
            }
          }}
          disabled={!!entityUri || !isEditing}
          error={!!uriError}
          sx={{
            mb: 2,
            "& .MuiInputBase-input": { fontSize: "0.875rem", py: 0.75 },
            "& .MuiInputLabel-outlined": { fontSize: "0.875rem" },
            "& .MuiInputBase-root.Mui-disabled": {
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
            "& .MuiInputBase-input.Mui-disabled": {
              WebkitTextFillColor: "rgba(0, 0, 0, 0.75)",
            },
          }}
          size="small"
          placeholder={t("placeholders.enterUri")}
        />

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

        {/* Controlled Properties Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableControlledProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.controlledValues")}
              </Typography>

              {availableControlledProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addCategory", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedControlledProperty}
                    label={t("common:labels.addCategory", { ns: "common" })}
                    onChange={(e) =>
                      setSelectedControlledProperty(e.target.value)
                    }
                    disabled={!classUri}
                  >
                    {availableControlledProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedControlledProperty && (
          <ObjectPropertySelector
            config={config}
            propertyUri={selectedControlledProperty}
            rangeUri={
              objectProperties.find((p) => p.uri === selectedControlledProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addControlledProperty}
            onCancel={() => setSelectedControlledProperty("")}
          />
        )}

        {controlledPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              objectProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {/* Related Agents Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableAgentProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.relatedAgents")}
              </Typography>

              {availableAgentProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addAgent", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedAgentProperty}
                    label={t("common:labels.addAgent", { ns: "common" })}
                    onChange={(e) => setSelectedAgentProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableAgentProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedAgentProperty && (
          <RelatedAgentsSelector
            config={config}
            propertyUri={selectedAgentProperty}
            rangeUri={
              agentProperties.find((p) => p.uri === selectedAgentProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addAgentProperty}
            onCancel={() => setSelectedAgentProperty("")}
          />
        )}

        {agentPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              agentProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {/* Basic WEMI Relationships Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableWEMIProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.wemiRelationships")}
              </Typography>

              {availableWEMIProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addWEMI", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedWEMIProperty}
                    label={t("common:labels.addWEMI", { ns: "common" })}
                    onChange={(e) => setSelectedWEMIProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableWEMIProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedWEMIProperty && (
          <WEMIRelationshipSelector
            config={config}
            propertyUri={selectedWEMIProperty}
            rangeUri={
              wemiProperties.find((p) => p.uri === selectedWEMIProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addWEMIProperty}
            onCancel={() => setSelectedWEMIProperty("")}
          />
        )}

        {wemiPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              wemiProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {/* Related Works Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableRelatedWorkProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.relatedWorks")}
              </Typography>

              {availableRelatedWorkProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addRelatedWork", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedRelatedWorkProperty}
                    label={t("common:labels.addRelatedWork", { ns: "common" })}
                    onChange={(e) => setSelectedRelatedWorkProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableRelatedWorkProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedRelatedWorkProperty && (
          <RelatedWorkSelector
            config={config}
            propertyUri={selectedRelatedWorkProperty}
            rangeUri={
              relatedWorkProperties.find((p) => p.uri === selectedRelatedWorkProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addRelatedWorkProperty}
            onCancel={() => setSelectedRelatedWorkProperty("")}
          />
        )}

        {relatedWorkPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              relatedWorkProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {/* Related Expressions Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableRelatedExpressionProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.relatedExpressions")}
              </Typography>

              {availableRelatedExpressionProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addRelatedExpression", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedRelatedExpressionProperty}
                    label={t("common:labels.addRelatedExpression", { ns: "common" })}
                    onChange={(e) => setSelectedRelatedExpressionProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableRelatedExpressionProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedRelatedExpressionProperty && (
          <RelatedExpressionSelector
            config={config}
            propertyUri={selectedRelatedExpressionProperty}
            rangeUri={
              relatedExpressionProperties.find((p) => p.uri === selectedRelatedExpressionProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addRelatedExpressionProperty}
            onCancel={() => setSelectedRelatedExpressionProperty("")}
          />
        )}

        {relatedExpressionPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              relatedExpressionProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {/* Related Manifestations Section */}
        {isEditing && (
          <>
            <Divider sx={{ my: 1.5 }} />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ color: availableRelatedManifestationProperties.length === 0 ? 'text.disabled' : 'text.primary' }}
              >
                {t("sections.relatedManifestations")}
              </Typography>

              {availableRelatedManifestationProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t("common:labels.addRelatedManifestation", { ns: "common" })}</InputLabel>
                  <Select
                    value={selectedRelatedManifestationProperty}
                    label={t("common:labels.addRelatedManifestation", { ns: "common" })}
                    onChange={(e) => setSelectedRelatedManifestationProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableRelatedManifestationProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getObjectPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {selectedRelatedManifestationProperty && (
          <RelatedManifestationSelector
            config={config}
            propertyUri={selectedRelatedManifestationProperty}
            rangeUri={
              relatedManifestationProperties.find((p) => p.uri === selectedRelatedManifestationProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addRelatedManifestationProperty}
            onCancel={() => setSelectedRelatedManifestationProperty("")}
          />
        )}

        {relatedManifestationPropertiesWithValues.map((propertyUri) => (
          <ObjectPropertySection
            key={propertyUri}
            config={config}
            propertyUri={propertyUri}
            propertyLabel={getObjectPropertyLabel(propertyUri)}
            values={entityData[propertyUri]}
            rangeUri={
              relatedManifestationProperties.find((p) => p.uri === propertyUri)?.range
            }
            isEditing={isEditing && !!classUri}
            selectedLanguage={selectedLanguage}
            onUpdateValue={(index, value) =>
              updatePropertyValue(propertyUri, index, value)
            }
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}
      </Box>

      {/* Label Manager Dialog */}
      <LabelManager
        open={labelManagerOpen}
        onClose={() => setLabelManagerOpen(false)}
        onSave={handleLabelsSave}
        initialLabels={entityLabels}
        config={config}
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
