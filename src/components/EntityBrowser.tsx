import React, { useState, useMemo, useCallback } from "react";
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
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  useRdfClasses,
  useRdfProperties,
  useRdfObjectProperties,
  useEntitiesByClass,
} from "../hooks/useSparqlQueries";
import EntityEditor from "./EntityEditor";
import { formatLabel } from "../utils/labelUtils";

interface EntityBrowserProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const EntityBrowser: React.FC<EntityBrowserProps> = ({
  config,
  selectedLanguage,
}) => {
  const { t } = useTranslation();
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

  // Filter entities based on the filter text (memoized for performance)
  const filteredEntities = useMemo(() => {
    return entities?.filter((entity) =>
      entity.label.toLowerCase().includes(entityFilter.toLowerCase()),
    );
  }, [entities, entityFilter]);

  // Memoized callbacks for handlers
  const handleClassSelect = useCallback((classUri: string) => {
    setSelectedClass(classUri);
    setSelectedEntity(null);
  }, []);

  const handleEntitySelect = useCallback((entityUri: string) => {
    setSelectedEntity(entityUri);
  }, []);

  const handleEntityDeselect = useCallback(() => {
    setSelectedEntity(null);
  }, []);

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
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "250px 1fr",
            lg: "minmax(200px, 1fr) minmax(350px, 1.5fr) minmax(550px, 2.5fr)",
          },
          gap: 3,
          height: "calc(100vh - 160px)",
          overflow: "hidden",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Paper elevation={1} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", minHeight: 72, display: "flex", alignItems: "center" }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center" }}
              >
                <Class sx={{ mr: 1 }} />
                {t("navigation.classes")}
              </Typography>
            </Box>

            {classesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ flex: 1, overflow: "auto" }}>
                {classes?.map((rdfClass) => (
                  <ListItem key={rdfClass.uri} disablePadding>
                    <ListItemButton
                      selected={selectedClass === rdfClass.uri}
                      onClick={() => handleClassSelect(rdfClass.uri)}
                    >
                      <ListItemText
                        primary={formatLabel(rdfClass.label, rdfClass.uri)}
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

        <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Paper elevation={1} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: "divider",
                minHeight: 72,
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
                {t("navigation.entities")}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  flex: 1,
                }}
              >
                {selectedClass && (
                  <Chip
                    label={formatLabel(
                      classes?.find((c) => c.uri === selectedClass)?.label,
                      selectedClass,
                    )}
                    size="small"
                  />
                )}
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {selectedClass && (
                  <TextField
                    size="small"
                    placeholder={t("labels.filter")}
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    sx={{ width: 130 }}
                    aria-label={t("labels.filter")}
                    InputProps={{
                      startAdornment: (
                        <Search
                          sx={{
                            mr: 1,
                            color: "action.active",
                            fontSize: "1rem",
                          }}
                        />
                      ),
                    }}
                  />
                )}
              </Box>
            </Box>

            {!selectedClass ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {t("messages.selectClass")}
              </Box>
            ) : entitiesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : filteredEntities?.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {entityFilter
                  ? t("messages.noEntitiesMatching", { filter: entityFilter })
                  : t("messages.noEntitiesForClass")}
              </Box>
            ) : (
              <List sx={{ flex: 1, overflow: "auto" }}>
                {filteredEntities?.map((entity) => (
                  <ListItem
                    key={`${selectedClass}-${entity.uri}`}
                    disablePadding
                  >
                    <ListItemButton
                      selected={selectedEntity === entity.uri}
                      onClick={() => handleEntitySelect(entity.uri)}
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

        <Box sx={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
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
            onEntityDeselected={handleEntityDeselect}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default EntityBrowser;
