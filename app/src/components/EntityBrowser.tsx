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
  TextField,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { Class, Description, Edit, Search, Tag } from "@mui/icons-material";
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
  const [isEditorEditing, setIsEditorEditing] = useState(false);
  // URI that the user clicked while the editor had unsaved changes
  const [pendingEntityUri, setPendingEntityUri] = useState<string | null>(null);
  const [switchEntityDialogOpen, setSwitchEntityDialogOpen] = useState(false);

  // Reset filter when class changes
  React.useEffect(() => {
    setEntityFilter("");
    setSelectedEntity(null);
    setIsEditorEditing(false);
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
    if (isEditorEditing && entityUri !== selectedEntity) {
      // Editor has unsaved changes — ask for confirmation before switching
      setPendingEntityUri(entityUri);
      setSwitchEntityDialogOpen(true);
    } else {
      setSelectedEntity(entityUri);
    }
  }, [isEditorEditing, selectedEntity]);

  const handleEntityDeselect = useCallback(() => {
    setSelectedEntity(null);
    setIsEditorEditing(false);
  }, []);

  const handleSwitchConfirm = useCallback(() => {
    if (pendingEntityUri !== null) {
      setSelectedEntity(pendingEntityUri);
      setIsEditorEditing(false);
    }
    setPendingEntityUri(null);
    setSwitchEntityDialogOpen(false);
  }, [pendingEntityUri]);

  const handleSwitchCancel = useCallback(() => {
    setPendingEntityUri(null);
    setSwitchEntityDialogOpen(false);
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
            md: "minmax(160px, 0.8fr) minmax(220px, 1fr) minmax(360px, 2.2fr)",
          },
          gap: 3,
          height: { xs: "auto", md: "calc(100vh - 160px)" },
          overflow: { xs: "visible", md: "hidden" },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", overflow: { xs: "visible", md: "hidden" } }}>
          <Paper elevation={1} sx={{ height: { xs: "auto", md: "100%" }, display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", height: 64, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <Class sx={{ mr: 1 }} />
                {t("navigation.classes")}
              </Typography>
              {selectedClass && (
                <Chip
                  label={formatLabel(
                    classes?.find((c) => c.uri === selectedClass)?.label,
                    selectedClass,
                  )}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>

            {classesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : !classes || classes.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {t("messages.noClassesFound")}
              </Box>
            ) : (
              <List sx={{ flex: 1, overflow: "auto", maxHeight: { xs: 280, md: "none" } }}>
                {classes.map((rdfClass) => (
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

        <Box sx={{ display: "flex", flexDirection: "column", overflow: { xs: "visible", md: "hidden" } }}>
          <Paper elevation={1} sx={{ height: { xs: "auto", md: "100%" }, display: "flex", flexDirection: "column" }}>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: "divider",
                height: 64,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <Description sx={{ mr: 1 }} />
                {t("navigation.entities")}
              </Typography>

              {/* Count badge: "n of total" when filtered, just "n" otherwise */}
              {selectedClass && !entitiesLoading && entities && (
                <Chip
                  label={
                    entityFilter && filteredEntities
                      ? t("messages.entityCountFiltered", {
                          shown: filteredEntities.length,
                          total: entities.length,
                        })
                      : String(entities.length)
                  }
                  size="small"
                  variant="outlined"
                  sx={{ flexShrink: 0 }}
                />
              )}

              <TextField
                size="small"
                placeholder={t("labels.filter")}
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                disabled={!selectedClass}
                sx={{ flex: 1, minWidth: 80 }}
                aria-label={t("labels.filter")}
                slotProps={{
                  input: {
                    startAdornment: (
                      <Search
                        sx={{
                          mr: 1,
                          color: "action.active",
                          fontSize: "1rem",
                        }}
                      />
                    ),
                  },
                }}
              />
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
              <List sx={{ flex: 1, overflow: "auto", maxHeight: { xs: 360, md: "none" } }}>
                {filteredEntities?.map((entity) => {
                  const isActiveEditing =
                    isEditorEditing && selectedEntity === entity.uri;
                  return (
                    <ListItem
                      key={`${selectedClass}-${entity.uri}`}
                      disablePadding
                    >
                      <ListItemButton
                        selected={selectedEntity === entity.uri}
                        onClick={() => handleEntitySelect(entity.uri)}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                                {entity.label}
                              </Typography>
                              {isActiveEditing && (
                                <Tooltip title={t("messages.entityBeingEdited")} placement="left">
                                  <Edit
                                    sx={{
                                      fontSize: "0.875rem",
                                      color: "warning.main",
                                      flexShrink: 0,
                                    }}
                                  />
                                </Tooltip>
                              )}
                              <Tooltip title={entity.uri} placement="bottom-start">
                                <Tag sx={{ fontSize: "0.875rem", color: "text.disabled", flexShrink: 0 }} />
                              </Tooltip>
                            </Box>
                          }
                          disableTypography
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", overflow: { xs: "visible", md: "hidden" } }}>
          <EntityEditor
            config={config}
            classUri={selectedClass || ""}
            className={selectedClass
              ? formatLabel(classes?.find((c) => c.uri === selectedClass)?.label, selectedClass)
              : null}
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
            onEditingChange={setIsEditorEditing}
          />
        </Box>
      </Box>
      {/* Unsaved changes guard when switching entities */}
      <Dialog
        open={switchEntityDialogOpen}
        onClose={handleSwitchCancel}
        aria-labelledby="switch-entity-dialog-title"
      >
        <DialogTitle id="switch-entity-dialog-title">
          {t("messages.switchEntityTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("messages.switchEntityMessage")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSwitchCancel}>
            {t("buttons.cancel")}
          </Button>
          <Button onClick={handleSwitchConfirm} color="warning" variant="contained">
            {t("messages.switchEntityConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EntityBrowser;
