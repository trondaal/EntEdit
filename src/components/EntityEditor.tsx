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
import type { SparqlEndpointConfig, RdfProperty } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import LabelManager from "./LabelManager";
import EntityEditorHeader from "./EntityEditorHeader";
import EntityLabelsSection from "./EntityLabelsSection";
import DataPropertiesSection from "./DataPropertiesSection";
import ObjectPropertySection from "./ObjectPropertySection";
import ObjectPropertySelector from "./ObjectPropertySelector";
import { invalidateEntityCaches } from "../utils/queryInvalidation";
import { escapeSparqlLiteral, isValidUri, formatLabel } from "../utils/labelUtils";

interface EntityEditorProps {
  config: SparqlEndpointConfig;
  classUri: string;
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
  entityUri,
  properties,
  objectProperties,
  propertiesLoading,
  objectPropertiesLoading,
  selectedLanguage,
  onEntitySaved,
  onEntityDeselected,
}) => {
  const queryClient = useQueryClient();
  const [entityData, setEntityData] = useState<Record<string, string[]>>({});
  const [isEditing, setIsEditing] = useState(!entityUri);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedObjectProperty, setSelectedObjectProperty] =
    useState<string>("");
  const [selectedControlledProperty, setSelectedControlledProperty] =
    useState<string>("");
  const [customEntityUri, setCustomEntityUri] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
      setSelectedObjectProperty("");
      setSelectedControlledProperty("");
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
    setSelectedObjectProperty("");
    setSelectedControlledProperty("");
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
        SELECT DISTINCT ?property ?value WHERE {
          <${entityUri}> ?property ?value .

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
      } else {
        setIsEditing(false);
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
    const property = objectProperties.find((p) => p.uri === propertyUri);
    return formatLabel(property?.label, propertyUri);
  }, [objectProperties]);

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

  const addObjectProperty = useCallback((selectedEntityUri: string) => {
    if (selectedObjectProperty && selectedEntityUri && isEditing) {
      setEntityData((prev) => {
        const currentValues = prev[selectedObjectProperty] || [];
        return {
          ...prev,
          [selectedObjectProperty]: [...currentValues, selectedEntityUri],
        };
      });
      setSelectedObjectProperty("");
    }
  }, [selectedObjectProperty, isEditing]);

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
  const objectPropertiesWithValues = useMemo(() => {
    return Object.keys(entityData).filter((property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isObjectProperty = objectProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isObjectProperty;
    });
  }, [entityData, objectProperties]);

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

  // Get available properties for dropdown (excluding rdfs:label)
  const availableObjectProperties = useMemo(() => {
    return objectProperties.filter(
      (property) => property.status === "object property",
    );
  }, [objectProperties]);

  // Available controlled properties are those with status "controlled property"
  const availableControlledProperties = useMemo(() => {
    return objectProperties.filter(
      (property) => property.status === "controlled property",
    );
  }, [objectProperties]);

  const uriError = useMemo(() => {
    return customEntityUri && !isValidUri(customEntityUri);
  }, [customEntityUri]);

  // Additional handlers for the header component
  const handleEdit = useCallback(() => setIsEditing(true), []);
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEntityData(existingEntity?.data || {});
    setEntityLabels(existingEntity?.labels || []);
  }, [existingEntity]);
  const handleDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);
  const handleNew = useCallback(() => onEntityDeselected?.(), [onEntityDeselected]);
  const handleEditLabels = useCallback(() => setLabelManagerOpen(true), []);

  const handlePropertySelect = useCallback((propertyUri: string) => {
    addProperty(propertyUri);
    setSelectedProperty("");
  }, [addProperty]);

  if (entityLoading || propertiesLoading || objectPropertiesLoading) {
    return (
      <Paper
        elevation={1}
        sx={{
          p: 3,
          textAlign: "center",
          minHeight: 800,
          height: "fit-content",
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ minHeight: 700, height: "fit-content" }}>
      <EntityEditorHeader
        entityUri={entityUri}
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
      />

      <Box sx={{ p: 3 }}>
        {!classUri && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Please select a class from the left panel to create a new entity.
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <EntityLabelsSection
          entityLabels={entityLabels}
          selectedLanguage={selectedLanguage}
          isEditing={isEditing}
          classUri={classUri}
          onEditLabels={handleEditLabels}
        />

        <TextField
          fullWidth
          label="Identifier (URI)"
          value={entityUri || customEntityUri}
          onChange={(e) => {
            if (!entityUri) {
              // Only allow editing for new entities
              setCustomEntityUri(e.target.value);
            }
          }}
          disabled={!!entityUri || !isEditing}
          error={!!uriError}
          sx={{ mb: 2 }}
          size="small"
          placeholder="Enter custom URI or leave empty for auto-generation"
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
              <Typography variant="subtitle1">Controlled values</Typography>

              {availableControlledProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Add category</InputLabel>
                  <Select
                    value={selectedControlledProperty}
                    label="Add category"
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

        {/* Object Properties Section */}
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
              <Typography variant="subtitle1">Related entities</Typography>

              {availableObjectProperties.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Add related</InputLabel>
                  <Select
                    value={selectedObjectProperty}
                    label="Add related"
                    onChange={(e) => setSelectedObjectProperty(e.target.value)}
                    disabled={!classUri}
                  >
                    {availableObjectProperties.map((property) => (
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

        {objectPropertiesWithValues.map((propertyUri) => (
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

        {selectedObjectProperty && (
          <ObjectPropertySelector
            config={config}
            propertyUri={selectedObjectProperty}
            rangeUri={
              objectProperties.find((p) => p.uri === selectedObjectProperty)
                ?.range
            }
            selectedLanguage={selectedLanguage}
            onSelect={addObjectProperty}
            onCancel={() => setSelectedObjectProperty("")}
          />
        )}
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
        <DialogTitle id="delete-dialog-title">Delete Entity</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this entity? This action will
            permanently remove all statements about this entity from the
            database and cannot be undone.
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontWeight: "bold" }}>
            Entity: {entityUri}
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
            Cancel
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
            {deleting ? "Deleting..." : "Delete Entity"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EntityEditor;
