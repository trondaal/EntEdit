import React, { useState } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  CircularProgress,
  Alert,
  Box,
  Chip,
} from '@mui/material';
import { Class, Description } from '@mui/icons-material';
import type { SparqlEndpointConfig } from '../types/sparql';
import { useRdfClasses, useRdfProperties, useRdfObjectProperties, useEntitiesByClass } from '../hooks/useSparqlQueries';
import EntityEditor from './EntityEditor';

interface EntityBrowserProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const EntityBrowser: React.FC<EntityBrowserProps> = ({ config, selectedLanguage }) => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const { 
    data: classes, 
    isLoading: classesLoading, 
    error: classesError 
  } = useRdfClasses(config, selectedLanguage);

  const { 
    data: properties, 
    isLoading: propertiesLoading 
  } = useRdfProperties(config, selectedClass || undefined, selectedLanguage);

  const { 
    data: objectProperties, 
    isLoading: objectPropertiesLoading 
  } = useRdfObjectProperties(config, selectedClass || undefined, selectedLanguage);

  const { 
    data: entities, 
    isLoading: entitiesLoading 
  } = useEntitiesByClass(config, selectedClass || '');

  if (classesError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to connect to SPARQL endpoint: {(classesError as Error).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Box sx={{ flex: '0 0 300px', minWidth: 300, alignSelf: 'flex-start' }}>
        <Paper elevation={1} sx={{ height: 'fit-content', minHeight: 500 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Class sx={{ mr: 1 }} />
              RDF Classes
            </Typography>
          </Box>
          
          {classesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {classes?.map((rdfClass) => (
                <ListItem key={rdfClass.uri} disablePadding>
                  <ListItemButton
                    selected={selectedClass === rdfClass.uri}
                    onClick={() => {
                      setSelectedClass(rdfClass.uri);
                      setSelectedEntity(null);
                    }}
                  >
                    <ListItemText
                      primary={rdfClass.label || rdfClass.uri.split('#').pop() || rdfClass.uri}
                      secondary={rdfClass.comment}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Box>

      <Box sx={{ flex: '0 0 300px', minWidth: 300, alignSelf: 'flex-start' }}>
        <Paper elevation={1} sx={{ height: 'fit-content', minHeight: 500 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Description sx={{ mr: 1 }} />
              Entities
            </Typography>
            {selectedClass && (
              <Chip 
                label={classes?.find(c => c.uri === selectedClass)?.label || selectedClass.split('#').pop()}
                size="small"
              />
            )}
          </Box>
          
          {!selectedClass ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              Select a class to view entities
            </Box>
          ) : entitiesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {entities?.map((entity) => (
                <ListItem key={`${selectedClass}-${entity.uri}`} disablePadding>
                  <ListItemButton
                    selected={selectedEntity === entity.uri}
                    onClick={() => setSelectedEntity(entity.uri)}
                  >
                    <ListItemText
                      primary={entity.label}
                      secondary={entity.uri}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Box>

      <Box sx={{ flex: '0 0 600px', minWidth: 600, alignSelf: 'flex-start' }}>
        <EntityEditor
          config={config}
          classUri={selectedClass}
          entityUri={selectedEntity}
          properties={properties || []}
          objectProperties={objectProperties || []}
          propertiesLoading={propertiesLoading}
          objectPropertiesLoading={objectPropertiesLoading}
          onEntitySaved={() => {
            // Optionally refetch entities list
          }}
        />
      </Box>
      </Box>
    </Box>
  );
};

export default EntityBrowser;