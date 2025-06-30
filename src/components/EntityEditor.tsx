import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Edit, Save, Add, Delete } from '@mui/icons-material';
import type { SparqlEndpointConfig, RdfProperty } from '../types/sparql';
import { SparqlClient } from '../utils/sparqlClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEntitiesByRange } from '../hooks/useSparqlQueries';

interface EntityEditorProps {
  config: SparqlEndpointConfig;
  classUri: string;
  entityUri: string | null;
  properties: RdfProperty[];
  objectProperties: RdfProperty[];
  propertiesLoading: boolean;
  objectPropertiesLoading: boolean;
  onEntitySaved: () => void;
}

const EntityEditor: React.FC<EntityEditorProps> = ({
  config,
  classUri,
  entityUri,
  properties,
  objectProperties,
  propertiesLoading,
  objectPropertiesLoading,
  onEntitySaved,
}) => {
  const queryClient = useQueryClient();
  const [entityData, setEntityData] = useState<Record<string, string[]>>({});
  const [isEditing, setIsEditing] = useState(!entityUri);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedObjectProperty, setSelectedObjectProperty] = useState<string>('');
  const [customEntityUri, setCustomEntityUri] = useState<string>('');

  const { data: existingEntity, isLoading: entityLoading } = useQuery({
    queryKey: ['entity', config.url, entityUri],
    queryFn: async () => {
      if (!entityUri) return null;
      
      const client = new SparqlClient(config);
      const query = `
        SELECT ?property ?value
        WHERE {
          <${entityUri}> ?property ?value .
        }
      `;
      
      const response = await client.query(query);
      const data: Record<string, string[]> = {};
      
      response.results.bindings.forEach(binding => {
        const property = binding.property.value;
        const value = binding.value.value;
        
        if (!data[property]) {
          data[property] = [];
        }
        data[property].push(value);
      });
      
      return data;
    },
    enabled: !!entityUri && !!config.url,
  });

  useEffect(() => {
    if (existingEntity) {
      setEntityData(existingEntity);
      setIsEditing(false);
    } else if (!entityUri) {
      setEntityData({});
      setIsEditing(true);
      setCustomEntityUri(''); // Clear custom URI for new entities
    }
  }, [existingEntity, entityUri]);

  const handleSave = async () => {
    if (!classUri) return; // Don't save if no class is selected
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const client = new SparqlClient(config);
      // Use existing URI, custom URI, or generate one
      const currentEntityUri = entityUri || customEntityUri.trim() || `http://example.org/entity-${Date.now()}`;
      
      const triples = [`<${currentEntityUri}> a <${classUri}> .`];
      
      Object.entries(entityData).forEach(([property, values]) => {
        values.forEach(value => {
          if (value.trim()) {
            // Simple heuristic: if value looks like a URI, don't quote it
            const formattedValue = value.startsWith('http') ? `<${value}>` : `"${value}"`;
            triples.push(`<${currentEntityUri}> <${property}> ${formattedValue} .`);
          }
        });
      });
      
      const insertQuery = `
        INSERT DATA {
          ${triples.join('\n          ')}
        }
      `;
      
      if (entityUri) {
        // For existing entities, we should delete old triples first
        const deleteQuery = `
          DELETE {
            <${entityUri}> ?p ?o .
          }
          WHERE {
            <${entityUri}> ?p ?o .
          }
        `;
        await client.update(deleteQuery);
      }
      
      await client.update(insertQuery);
      
      // Invalidate and refetch the entities list for this class
      queryClient.invalidateQueries({
        queryKey: ['entities-by-class', config.url, classUri]
      });
      
      // If this was a new entity, also invalidate the current entity query to reflect the new URI
      if (!entityUri) {
        queryClient.invalidateQueries({
          queryKey: ['entity', config.url]
        });
      } else {
        // For existing entities, invalidate the specific entity query
        queryClient.invalidateQueries({
          queryKey: ['entity', config.url, entityUri]
        });
      }
      
      setIsEditing(false);
      onEntitySaved();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const getPropertyLabel = (propertyUri: string) => {
    const property = properties.find(p => p.uri === propertyUri);
    return property?.label || propertyUri.split('#').pop() || propertyUri;
  };

  const getObjectPropertyLabel = (propertyUri: string) => {
    const property = objectProperties.find(p => p.uri === propertyUri);
    return property?.label || propertyUri.split('#').pop() || propertyUri;
  };

  const addProperty = (propertyUri: string) => {
    if (propertyUri && isEditing) {
      const currentValues = entityData[propertyUri] || [];
      setEntityData({
        ...entityData,
        [propertyUri]: [...currentValues, '']
      });
    }
  };

  const addObjectProperty = (selectedEntityUri: string) => {
    if (selectedObjectProperty && selectedEntityUri && isEditing) {
      const currentValues = entityData[selectedObjectProperty] || [];
      setEntityData({
        ...entityData,
        [selectedObjectProperty]: [...currentValues, selectedEntityUri]
      });
      setSelectedObjectProperty('');
    }
  };

  const updatePropertyValue = (property: string, index: number, value: string) => {
    const values = [...(entityData[property] || [])];
    values[index] = value;
    setEntityData({
      ...entityData,
      [property]: values
    });
  };

  const removePropertyValue = (property: string, index: number) => {
    const values = entityData[property] || [];
    const newValues = values.filter((_, i) => i !== index);
    if (newValues.length === 0) {
      const { [property]: removed, ...rest } = entityData;
      setEntityData(rest);
    } else {
      setEntityData({
        ...entityData,
        [property]: newValues
      });
    }
  };

  // Get properties that have values, separated by type
  const dataPropertiesWithValues = Object.keys(entityData).filter(
    property => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isDataProperty = properties.some(p => p.uri === property);
      return hasValues && isDataProperty;
    }
  );

  const objectPropertiesWithValues = Object.keys(entityData).filter(
    property => {
      const hasValues = entityData[property] && entityData[property].length > 0;
      const isObjectProperty = objectProperties.some(p => p.uri === property);
      return hasValues && isObjectProperty;
    }
  );

  // Get available properties for dropdown (excluding rdfs:label)
  const availableProperties = properties.filter(
    property => property.uri !== 'http://www.w3.org/2000/01/rdf-schema#label'
  );

  const availableObjectProperties = objectProperties;

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
      <Paper elevation={1} sx={{ p: 3, textAlign: 'center', minHeight: 500, height: 'fit-content' }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ minHeight: 500, height: 'fit-content' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          {entityUri ? <Edit sx={{ mr: 1 }} /> : <Add sx={{ mr: 1 }} />}
          {entityUri ? 'Edit Entity' : 'Create New Entity'}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isEditing ? (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={saving || !!uriError || !classUri}
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              {entityUri && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setIsEditing(false);
                    setEntityData(existingEntity || {});
                  }}
                >
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={() => setIsEditing(true)}
              startIcon={<Edit />}
            >
              Edit
            </Button>
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
        
        <TextField
          fullWidth
          label="Label (rdfs:label)"
          value={entityData['http://www.w3.org/2000/01/rdf-schema#label']?.[0] || ''}
          onChange={(e) => 
            setEntityData({ 
              ...entityData, 
              'http://www.w3.org/2000/01/rdf-schema#label': [e.target.value]
            })
          }
          disabled={!isEditing || !classUri}
          sx={{ mb: 2 }}
          helperText="Human-readable name for this entity"
          required
        />
        
        <TextField
          fullWidth
          label="Entity URI"
          value={entityUri || customEntityUri}
          onChange={(e) => {
            if (!entityUri) { // Only allow editing for new entities
              setCustomEntityUri(e.target.value);
            }
          }}
          disabled={!!entityUri || !isEditing}
          error={!!uriError}
          sx={{ mb: 2 }}
          helperText={
            uriError
              ? "Please enter a valid URI"
              : entityUri 
                ? "Existing entity URI (cannot be changed)" 
                : isEditing 
                  ? "Enter custom URI or leave empty for auto-generation"
                  : "URI will be generated automatically"
          }
          placeholder="http://example.org/my-entity"
        />
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1">
            Attributes
          </Typography>
          
          {isEditing && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Add Attribute</InputLabel>
              <Select
                value={selectedProperty}
                label="Add Attribute"
                onChange={(e) => {
                  const propertyUri = e.target.value;
                  addProperty(propertyUri);
                  setSelectedProperty('');
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
        
        {dataPropertiesWithValues
          .filter(propertyUri => propertyUri !== 'http://www.w3.org/2000/01/rdf-schema#label')
          .map((propertyUri) => (
            <Box key={propertyUri} sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {getPropertyLabel(propertyUri)}
              </Typography>
              {entityData[propertyUri].map((value, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TextField
                    fullWidth
                    value={value}
                    onChange={(e) => updatePropertyValue(propertyUri, index, e.target.value)}
                    disabled={!isEditing || !classUri}
                    size="small"
                    placeholder={`Enter ${getPropertyLabel(propertyUri)}`}
                  />
                  {isEditing && (
                    <IconButton
                      size="small"
                      onClick={() => removePropertyValue(propertyUri, index)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ))}

        {isEditing && availableObjectProperties.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1">
                Relationships
              </Typography>
              
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Add Relationship</InputLabel>
                <Select
                  value={selectedObjectProperty}
                  label="Add Relationship"
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
            rangeUri={objectProperties.find(p => p.uri === propertyUri)?.range}
            isEditing={isEditing && !!classUri}
            onUpdateValue={(index, value) => updatePropertyValue(propertyUri, index, value)}
            onRemoveValue={(index) => removePropertyValue(propertyUri, index)}
          />
        ))}

        {selectedObjectProperty && (
          <ObjectPropertySelector
            config={config}
            propertyUri={selectedObjectProperty}
            rangeUri={objectProperties.find(p => p.uri === selectedObjectProperty)?.range}
            onSelect={(entityUri) => {
              addObjectProperty(entityUri);
            }}
            onCancel={() => setSelectedObjectProperty('')}
          />
        )}
      </Box>
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
  onUpdateValue: (index: number, value: string) => void;
  onRemoveValue: (index: number) => void;
}

const ObjectPropertySection: React.FC<ObjectPropertySectionProps> = ({
  config,
  propertyUri,
  propertyLabel,
  values,
  rangeUri,
  isEditing,
  onUpdateValue,
  onRemoveValue,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {propertyLabel}
      </Typography>
      {values.map((value, index) => (
        <ObjectPropertyValue
          key={index}
          config={config}
          value={value}
          rangeUri={rangeUri}
          isEditing={isEditing}
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
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

const ObjectPropertyValue: React.FC<ObjectPropertyValueProps> = ({
  config,
  value,
  rangeUri,
  isEditing,
  onUpdate,
  onRemove,
}) => {
  const { data: entity } = useQuery({
    queryKey: ['entity-label', config.url, value],
    queryFn: async () => {
      if (!value) return null;
      
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?label
        WHERE {
          <${value}> rdfs:label ?label .
        }
        LIMIT 1
      `;
      
      const response = await client.query(query);
      return response.results.bindings[0]?.label?.value || null;
    },
    enabled: !!value && !!config.url,
  });

  const displayLabel = entity || value.split('#').pop() || value;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Box sx={{ flex: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {displayLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {value}
        </Typography>
      </Box>
      {isEditing && (
        <IconButton
          size="small"
          onClick={onRemove}
          color="error"
        >
          <Delete />
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
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const ObjectPropertySelector: React.FC<ObjectPropertySelectorProps> = ({
  config,
  propertyUri,
  rangeUri,
  onSelect,
  onCancel,
}) => {
  const { data: entities, isLoading } = useEntitiesByRange(config, rangeUri || '');

  if (!rangeUri) {
    return (
      <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
        <Typography color="warning.main">
          No range specified for this property. Cannot suggest entities.
        </Typography>
        <Button onClick={onCancel} sx={{ mt: 1 }}>
          Cancel
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <CircularProgress size={20} />
        <Typography sx={{ ml: 1, display: 'inline' }}>Loading entities...</Typography>
      </Box>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'info.main', borderRadius: 1 }}>
        <Typography color="info.main">
          No entities found of type {rangeUri.split('#').pop()}
        </Typography>
        <Button onClick={onCancel} sx={{ mt: 1 }}>
          Cancel
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2, p: 2, border: 1, borderColor: 'primary.main', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Select an entity for {propertyUri.split('#').pop()}:
      </Typography>
      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
        {entities.map((entity) => (
          <Button
            key={`${rangeUri}-${entity.uri}`}
            fullWidth
            variant="outlined"
            size="small"
            onClick={() => onSelect(entity.uri)}
            sx={{ 
              mb: 1, 
              justifyContent: 'flex-start',
              textAlign: 'left',
              display: 'block'
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {entity.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {entity.uri}
            </Typography>
          </Button>
        ))}
      </Box>
      <Button onClick={onCancel} sx={{ mt: 1 }}>
        Cancel
      </Button>
    </Box>
  );
};

export default EntityEditor;