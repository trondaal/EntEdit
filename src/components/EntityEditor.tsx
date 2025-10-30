import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  Edit,
  Save,
  Add,
  Delete,
  DeleteForever,
  AccountTree,
  Language,
} from "@mui/icons-material";
import type { SparqlEndpointConfig, RdfProperty } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEntitiesByRange } from "../hooks/useSparqlQueries";
import LabelManager from "./LabelManager";

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

  const handleSave = async () => {
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
      console.log("Entity labels to save:", entityLabels);
      entityLabels.forEach((label) => {
        if (label.value.trim()) {
          const escapedValue = label.value
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r");
          const formattedValue = label.language
            ? `"${escapedValue}"@${label.language}`
            : `"${escapedValue}"`;
          const labelTriple = `<${currentEntityUri}> <http://www.w3.org/2000/01/rdf-schema#label> ${formattedValue} .`;
          console.log("Adding label triple:", labelTriple);
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
              const escapedValue = value
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r");
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

      // Debug: Log the generated query
      console.log("Generated SPARQL INSERT query:", insertQuery);
      console.log("All triples to insert:", triples);

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

      // Invalidate and refetch the entities list for this class
      queryClient.invalidateQueries({
        queryKey: ["entities-by-class", config.url, classUri],
      });

      // Invalidate entity label queries
      queryClient.invalidateQueries({
        queryKey: ["entity-label", config.url],
      });

      // Invalidate caches for all affected entities (those in relationships)
      affectedEntityUris.forEach((affectedUri) => {
        queryClient.invalidateQueries({
          queryKey: ["entity", config.url, affectedUri],
        });
      });

      // If this was a new entity, also invalidate the current entity query to reflect the new URI
      if (!entityUri) {
        queryClient.invalidateQueries({
          queryKey: ["entity", config.url],
        });
        // Reset the create form for new entities
        resetCreateForm();
      } else {
        // For existing entities, invalidate the specific entity query
        queryClient.invalidateQueries({
          queryKey: ["entity", config.url, entityUri],
        });
        setIsEditing(false);
      }

      onEntitySaved();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
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
      // This ensures that both explicit triples and their inverses are removed
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

      // Invalidate and refetch the entities list for this class
      queryClient.invalidateQueries({
        queryKey: ["entities-by-class", config.url, classUri],
      });

      // Invalidate entity label queries
      queryClient.invalidateQueries({
        queryKey: ["entity-label", config.url],
      });

      // Invalidate caches for all affected entities (those that were in relationships)
      affectedEntityUris.forEach((affectedUri) => {
        queryClient.invalidateQueries({
          queryKey: ["entity", config.url, affectedUri],
        });
      });

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
  };

  const handleOpenGraph = () => {
    if (!entityUri) return;

    // Derive visualization base URI from SPARQL endpoint URL
    const url = new URL(config.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Encode the URI for the query parameter
    const encodedUri = encodeURIComponent(entityUri);
    const graphUrl = `${baseUrl}/graphs-visualizations?uri=${encodedUri}`;

    // Open in new tab
    window.open(graphUrl, "_blank");
  };

  const getPropertyLabel = (propertyUri: string) => {
    const property = properties.find((p) => p.uri === propertyUri);
    return property?.label || propertyUri.split("#").pop() || propertyUri;
  };

  const getObjectPropertyLabel = (propertyUri: string) => {
    const property = objectProperties.find((p) => p.uri === propertyUri);
    return property?.label || propertyUri.split("#").pop() || propertyUri;
  };

  // Get the primary label for display
  const getPrimaryLabel = () => {
    console.log("getPrimaryLabel called with entityLabels:", entityLabels);
    console.log("selectedLanguage:", selectedLanguage);

    if (entityLabels.length === 0) {
      console.log("No labels available");
      return null;
    }

    // First try to find a label in the selected language
    const selectedLangLabel = entityLabels.find(
      (label) => label.language === selectedLanguage,
    );
    if (selectedLangLabel) {
      console.log("Found label in selected language:", selectedLangLabel);
      return selectedLangLabel.value;
    }

    // Then try to find a label without language tag
    const noLangLabel = entityLabels.find((label) => label.language === "");
    if (noLangLabel) {
      console.log("Found label without language:", noLangLabel);
      return noLangLabel.value;
    }

    // Finally, return the first available label
    console.log("Using first available label:", entityLabels[0]);
    return entityLabels[0].value;
  };

  const handleLabelsSave = (
    labels: Array<{ id: string; value: string; language: string }>,
  ) => {
    console.log("Labels being saved:", labels);
    setEntityLabels(labels);
    setLabelManagerOpen(false);
  };

  const addProperty = (propertyUri: string) => {
    if (propertyUri && isEditing) {
      const currentValues = entityData[propertyUri] || [];
      setEntityData({
        ...entityData,
        [propertyUri]: [...currentValues, ""],
      });
    }
  };

  const addObjectProperty = (selectedEntityUri: string) => {
    if (selectedObjectProperty && selectedEntityUri && isEditing) {
      const currentValues = entityData[selectedObjectProperty] || [];
      setEntityData({
        ...entityData,
        [selectedObjectProperty]: [...currentValues, selectedEntityUri],
      });
      setSelectedObjectProperty("");
    }
  };

  const addControlledProperty = (selectedEntityUri: string) => {
    if (selectedControlledProperty && selectedEntityUri && isEditing) {
      const currentValues = entityData[selectedControlledProperty] || [];
      setEntityData({
        ...entityData,
        [selectedControlledProperty]: [...currentValues, selectedEntityUri],
      });
      setSelectedControlledProperty("");
    }
  };

  const updatePropertyValue = (
    property: string,
    index: number,
    value: string,
  ) => {
    const values = [...(entityData[property] || [])];
    values[index] = value;
    setEntityData({
      ...entityData,
      [property]: values,
    });
  };

  const removePropertyValue = (property: string, index: number) => {
    const values = entityData[property] || [];
    const newValues = values.filter((_, i) => i !== index);
    if (newValues.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [property]: _, ...rest } = entityData;
      setEntityData(rest);
    } else {
      setEntityData({
        ...entityData,
        [property]: newValues,
      });
    }
  };

  // Get properties that have values, separated by type
  const dataPropertiesWithValues = Object.keys(entityData).filter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isDataProperty = properties.some((p) => p.uri === property);
      return hasValues && isDataProperty;
    },
  );

  const objectPropertiesWithValues = Object.keys(entityData).filter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isObjectProperty = objectProperties.some(
        (p) => p.uri === property && p.status === "object property",
      );
      return hasValues && isObjectProperty;
    },
  );

  // Controlled properties are those with status "controlled property"
  const controlledPropertiesWithValues = Object.keys(entityData).filter(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (property) => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isControlledProperty = objectProperties.some(
        (p) => p.uri === property && p.status === "controlled property",
      );
      return hasValues && isControlledProperty;
    },
  );

  // Get available properties for dropdown (excluding rdfs:label)
  const availableProperties = properties.filter(
    (property) => property.uri !== "http://www.w3.org/2000/01/rdf-schema#label",
  );

  const availableObjectProperties = objectProperties.filter(
    (property) => property.status === "object property",
  );

  // Available controlled properties are those with status "controlled property"
  const availableControlledProperties = objectProperties.filter(
    (property) => property.status === "controlled property",
  );

  // Basic URI validation
  const isValidUri = (uri: string): boolean => {
    if (!uri.trim()) return true; // Empty is valid (will auto-generate)
    try {
      new URL(uri);
      return true;
    } catch {
      // Check if it's a valid URI pattern (not necessarily a URL)
      const uriPattern = /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/)/;
      return uriPattern.test(uri);
    }
  };

  const uriError = customEntityUri && !isValidUri(customEntityUri);

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
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center" }}>
          {entityUri ? <Edit sx={{ mr: 1 }} /> : <Add sx={{ mr: 1 }} />}
          {entityUri ? "Edit Entity" : "Create New Entity"}
        </Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          {isEditing ? (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={saving || !!uriError || !classUri}
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              {entityUri && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setIsEditing(false);
                    setEntityData(existingEntity?.data || {});
                    setEntityLabels(existingEntity?.labels || []);
                  }}
                >
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => setIsEditing(true)}
                startIcon={<Edit />}
              >
                Edit
              </Button>
              {entityUri && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpenGraph}
                    startIcon={<AccountTree />}
                    color="primary"
                  >
                    Graph
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onEntityDeselected?.()}
                    startIcon={<Add />}
                    color="success"
                  >
                    New
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setDeleteDialogOpen(true)}
                    startIcon={<DeleteForever />}
                    color="error"
                  >
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </Box>
      </Box>

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

        {/* Primary Label Display */}
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography variant="h6" color="primary">
              {getPrimaryLabel() || "No label"}
            </Typography>
            {isEditing && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Language />}
                onClick={() => setLabelManagerOpen(true)}
                disabled={!classUri}
              >
                Edit Labels
              </Button>
            )}
          </Box>
          {!getPrimaryLabel() && isEditing && (
            <Typography variant="body2" color="text.secondary">
              This entity has no labels. Click "Edit Labels" to add one.
            </Typography>
          )}
        </Box>

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
          /*helperText={
            uriError
              ? "Please enter a valid URI"
              : entityUri
                ? "Existing entity URI (cannot be changed)"
                : isEditing
                  ? "Enter custom URI or leave empty for auto-generation"
                  : "URI will be generated automatically"
          }*/
          placeholder="Enter custom URI or leave empty for auto-generation"
        />

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
              <Typography variant="subtitle1">Text metadata</Typography>

              {isEditing && (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Add text value</InputLabel>
                  <Select
                    value={selectedProperty}
                    label="Add text value"
                    onChange={(e) => {
                      const propertyUri = e.target.value;
                      addProperty(propertyUri);
                      setSelectedProperty("");
                    }}
                    disabled={!classUri}
                  >
                    {availableProperties.map((property) => (
                      <MenuItem key={property.uri} value={property.uri}>
                        {getPropertyLabel(property.uri)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </>
        )}

        {dataPropertiesWithValues
          .filter(
            (propertyUri) =>
              propertyUri !== "http://www.w3.org/2000/01/rdf-schema#label",
          )
          .map((propertyUri) => (
            <Box key={propertyUri} sx={{ mb: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                {getPropertyLabel(propertyUri)}
              </Typography>
              {entityData[propertyUri].map((value, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <TextField
                    fullWidth
                    // label={getPropertyLabel(propertyUri)}
                    value={value}
                    onChange={(e) =>
                      updatePropertyValue(propertyUri, index, e.target.value)
                    }
                    disabled={!isEditing || !classUri}
                    size="small"
                    placeholder={`Enter ${getPropertyLabel(propertyUri)}`}
                    sx={{
                      "& .MuiInputBase-input": { py: 0.75 },
                      "& .MuiInputLabel-outlined": {
                        color: "#4F4F4F",
                        fontSize: 17,
                        // And the label when it focused
                      },
                    }}
                  />
                  {isEditing && (
                    <IconButton
                      size="small"
                      onClick={() => removePropertyValue(propertyUri, index)}
                      color="error"
                      sx={{ p: 0.5 }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ))}

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

              {isEditing && availableControlledProperties.length > 0 && (
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
            onSelect={(entityUri) => {
              addControlledProperty(entityUri);
            }}
            onCancel={() => setSelectedControlledProperty("")}
          />
        )}

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

              {isEditing && availableObjectProperties.length > 0 && (
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
            onSelect={(entityUri) => {
              addObjectProperty(entityUri);
            }}
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

// Component for displaying object property values
interface ObjectPropertySectionProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  propertyLabel: string;
  values: string[];
  rangeUri?: string;
  isEditing: boolean;
  selectedLanguage: string;
  onUpdateValue: (index: number, value: string) => void;
  onRemoveValue: (index: number) => void;
}

const ObjectPropertySection: React.FC<ObjectPropertySectionProps> = ({
  config,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  propertyUri: _unused,
  propertyLabel,
  values,
  rangeUri,
  isEditing,
  selectedLanguage,
  onUpdateValue,
  onRemoveValue,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {propertyLabel}
      </Typography>
      {values.map((value, index) => (
        <ObjectPropertyValue
          key={index}
          config={config}
          value={value}
          rangeUri={rangeUri}
          isEditing={isEditing}
          selectedLanguage={selectedLanguage}
          onUpdate={(newValue) => onUpdateValue(index, newValue)}
          onRemove={() => onRemoveValue(index)}
        />
      ))}
    </Box>
  );
};

// Component for displaying a single object property value
interface ObjectPropertyValueProps {
  config: SparqlEndpointConfig;
  value: string;
  rangeUri?: string;
  isEditing: boolean;
  selectedLanguage: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

const ObjectPropertyValue: React.FC<ObjectPropertyValueProps> = ({
  config,
  value,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rangeUri: _,
  isEditing,
  selectedLanguage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdate: __,
  onRemove,
}) => {
  const { data: entity } = useQuery({
    queryKey: ["entity-label", config.url, value, selectedLanguage],
    queryFn: async () => {
      if (!value) return null;

      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?label ?lang
        WHERE {
          <${value}> rdfs:label ?label .
          BIND(LANG(?label) AS ?lang)
        }
      `;

      const response = await client.query(query);
      const labels = response.results.bindings.map((binding) => ({
        value: binding.label.value,
        language: binding.lang?.value || "",
      }));

      if (labels.length === 0) return null;

      // First try to find a label in the selected language
      const selectedLangLabel = labels.find(
        (label) => label.language === selectedLanguage,
      );
      if (selectedLangLabel) return selectedLangLabel.value;

      // Then try to find a label without language tag
      const noLangLabel = labels.find((label) => label.language === "");
      if (noLangLabel) return noLangLabel.value;

      // Finally, return the first available label
      return labels[0].value;
    },
    enabled: !!value && !!config.url,
  });

  const displayLabel = entity || value.split("#").pop() || value;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          flex: 1,
          p: 0.75,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", lineHeight: 1.2 }}
        >
          {displayLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1.1 }}
        >
          {value}
        </Typography>
      </Box>
      {isEditing && (
        <IconButton
          size="small"
          onClick={onRemove}
          color="error"
          sx={{ p: 0.5 }}
        >
          <Delete fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

// Component for selecting an entity for an object property
interface ObjectPropertySelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const ObjectPropertySelector: React.FC<ObjectPropertySelectorProps> = ({
  config,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  propertyUri: _,
  rangeUri,
  selectedLanguage,
  onSelect,
  onCancel,
}) => {
  const { data: entities, isLoading } = useEntitiesByRange(
    config,
    rangeUri || "",
    selectedLanguage,
  );

  if (!rangeUri) {
    return (
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: 1,
          borderColor: "warning.main",
          borderRadius: 1,
        }}
      >
        <Typography color="warning.main">
          No range specified for this property. Cannot suggest entities.
        </Typography>
        <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
          Cancel
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <CircularProgress size={20} />
        <Typography sx={{ ml: 1, display: "inline" }}>
          Loading entities...
        </Typography>
      </Box>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: 1,
          borderColor: "info.main",
          borderRadius: 1,
        }}
      >
        <Typography color="info.main">
          No entities found of type {rangeUri.split("#").pop()}
        </Typography>
        <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
          Cancel
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: 1,
        borderColor: "primary.main",
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Select an entity for relationship:
      </Typography>
      <Box sx={{ maxHeight: 200, overflow: "auto" }}>
        {entities.map((entity) => (
          <Button
            key={`${rangeUri}-${entity.uri}`}
            fullWidth
            variant="outlined"
            size="small"
            onClick={() => onSelect(entity.uri)}
            sx={{
              mb: 1,
              justifyContent: "flex-start",
              textAlign: "left",
              display: "block",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {entity.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {entity.uri}
            </Typography>
          </Button>
        ))}
      </Box>
      <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
        Cancel
      </Button>
    </Box>
  );
};

export default EntityEditor;
