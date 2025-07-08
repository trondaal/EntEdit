import React, { useState } from "react";
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
  TextField,
} from "@mui/material";
import { Class, Description, Search } from "@mui/icons-material";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  useRdfClasses,
  useRdfProperties,
  useRdfObjectProperties,
  useEntitiesByClass,
} from "../hooks/useSparqlQueries";
import EntityEditor from "./EntityEditor";

interface EntityBrowserProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const EntityBrowser: React.FC<EntityBrowserProps> = ({
  config,
  selectedLanguage,
}) => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("");

  // Reset filter when class changes
  React.useEffect(() => {
    setEntityFilter("");
    setSelectedEntity(null);
  }, [selectedClass]);

  const {
    data: classes,
    isLoading: classesLoading,
    error: classesError,
  } = useRdfClasses(config, selectedLanguage);

  const { data: properties, isLoading: propertiesLoading } = useRdfProperties(
    config,
    selectedClass || undefined,
    selectedLanguage,
  );

  const { data: objectProperties, isLoading: objectPropertiesLoading } =
    useRdfObjectProperties(
      config,
      selectedClass || undefined,
      selectedLanguage,
    );

  const { data: entities, isLoading: entitiesLoading } = useEntitiesByClass(
    config,
    selectedClass || "",
    selectedLanguage,
  );

  // Filter entities based on the filter text
  const filteredEntities = entities?.filter((entity) =>
    entity.label.toLowerCase().includes(entityFilter.toLowerCase()),
  );

  if (classesError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to connect to SPARQL endpoint: {(classesError as Error).message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ flex: "0 0 200px", minWidth: 200, alignSelf: "flex-start" }}>
          <Paper elevation={1} sx={{ height: "fit-content", minHeight: 600 }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Class sx={{ mr: 1 }} />
                Classes
              </Typography>
            </Box>

            {classesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: "auto" }}>
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
                        primary={
                          (
                            rdfClass.label ||
                            rdfClass.uri.split("#").pop() ||
                            rdfClass.uri
                          )
                            .charAt(0)
                            .toUpperCase() +
                          (
                            rdfClass.label ||
                            rdfClass.uri.split("#").pop() ||
                            rdfClass.uri
                          ).slice(1)
                        }
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

        <Box sx={{ flex: "0 0 400px", minWidth: 400, alignSelf: "flex-start" }}>
          <Paper elevation={1} sx={{ height: "fit-content", minHeight: 600 }}>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Description sx={{ mr: 1 }} />
                Entities
              </Typography>
              
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {selectedClass && (
                  <>
                    <Chip
                      label={
                        (
                          classes?.find((c) => c.uri === selectedClass)?.label ||
                          selectedClass.split("#").pop() ||
                          ""
                        )
                          .charAt(0)
                          .toUpperCase() +
                        (
                          classes?.find((c) => c.uri === selectedClass)?.label ||
                          selectedClass.split("#").pop() ||
                          ""
                        ).slice(1)
                      }
                      size="small"
                    />
                    <TextField
                      size="small"
                      placeholder="Filter..."
                      value={entityFilter}
                      onChange={(e) => setEntityFilter(e.target.value)}
                      sx={{ width: 150 }}
                      InputProps={{
                        startAdornment: (
                          <Search sx={{ mr: 1, color: "action.active", fontSize: "1rem" }} />
                        ),
                      }}
                    />
                  </>
                )}
              </Box>
            </Box>

            {!selectedClass ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                Select a class to view entities
              </Box>
            ) : entitiesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : filteredEntities?.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {entityFilter
                  ? `No entities found matching "${entityFilter}"`
                  : "No entities found for this class"}
              </Box>
            ) : (
              <List sx={{ maxHeight: 500, overflow: "auto" }}>
                {filteredEntities?.map((entity) => (
                  <ListItem
                    key={`${selectedClass}-${entity.uri}`}
                    disablePadding
                  >
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

        <Box sx={{ flex: "0 0 600px", minWidth: 600, alignSelf: "flex-start" }}>
          <EntityEditor
            config={config}
            classUri={selectedClass || ""}
            entityUri={selectedEntity}
            properties={properties || []}
            objectProperties={objectProperties || []}
            propertiesLoading={propertiesLoading}
            objectPropertiesLoading={objectPropertiesLoading}
            selectedLanguage={selectedLanguage}
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
