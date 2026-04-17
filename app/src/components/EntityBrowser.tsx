import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  useRdfClasses,
  useRdfProperties,
  useRdfObjectProperties,
} from "../hooks/useSchemaQueries";
import {
  useInfiniteEntitiesByClass,
  useEntityCountByClass,
} from "../hooks/useEntityQueries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import EntityEditor from "./EntityEditor";
import { formatLabel } from "../utils/labelUtils";
import { useLogging } from "../hooks/useLogging";

interface EntityBrowserProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  warnAutoUri: boolean;
  warnAutoLabel: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  onRegisterSave?: (handler: (() => Promise<void>) | null) => void;
  onRegisterDiscard?: (handler: (() => void) | null) => void;
}

const ITEM_HEIGHT = 42; // Approximate height of a single entity list item

const EntityBrowser: React.FC<EntityBrowserProps> = ({
  config,
  selectedLanguage,
  warnAutoUri,
  warnAutoLabel,
  onEditingChange,
  onRegisterSave,
  onRegisterDiscard,
}) => {
  const { t } = useTranslation();
  const { logEvent, isRecording } = useLogging();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [isEditorEditing, setIsEditorEditing] = useState(false);
  // URI that the user clicked while the editor had unsaved changes
  const [pendingEntityUri, setPendingEntityUri] = useState<string | null>(null);
  const [switchEntityDialogOpen, setSwitchEntityDialogOpen] = useState(false);
  // Debounce the filter text so SPARQL queries don't fire on every keystroke
  const debouncedFilter = useDebouncedValue(entityFilter, 300);

  // Ref for the scrollable container used by the virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset filter when class changes
  useEffect(() => {
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

  // Infinite paginated entity query (server-side filter via debounced value)
  const {
    data: entitiesData,
    isLoading: entitiesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteEntitiesByClass(
    config,
    selectedClass || "",
    selectedLanguage,
    debouncedFilter,
  );

  // Parallel count queries: total + filtered
  const { data: totalCount } = useEntityCountByClass(
    config,
    selectedClass || "",
    selectedLanguage,
    "", // no filter → total count
  );

  const { data: filteredCount } = useEntityCountByClass(
    config,
    selectedClass || "",
    selectedLanguage,
    debouncedFilter, // filtered count (same as total when no filter)
  );

  // Flatten all pages into a single array
  const entities = useMemo(
    () => entitiesData?.pages.flat() ?? [],
    [entitiesData],
  );

  // Set up virtualizer for the entity list
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  // Fetch next page when user scrolls near the bottom of the container.
  // Uses a direct onScroll handler instead of watching virtualizer state,
  // because the scroll container is conditionally rendered and may not be
  // connected when the virtualizer initialises.
  const handleEntityListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  // Memoized callbacks for handlers
  const handleClassSelect = useCallback((classUri: string) => {
    setSelectedClass(classUri);
    setSelectedEntity(null);
    if (isRecording) {
      logEvent({ type: "class_selected", classUri });
    }
  }, [isRecording, logEvent]);

  const handleEntitySelect = useCallback((entityUri: string) => {
    if (isEditorEditing && entityUri !== selectedEntity) {
      setPendingEntityUri(entityUri);
      setSwitchEntityDialogOpen(true);
    } else {
      setSelectedEntity(entityUri);
      if (isRecording && selectedClass) {
        logEvent({ type: "entity_selected", entityUri, classUri: selectedClass, source: "browser" });
      }
    }
  }, [isEditorEditing, selectedEntity, isRecording, selectedClass, logEvent]);

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

  // Build the count label for the entity panel header
  // (must be before early return to satisfy Rules of Hooks)
  const countLabel = useMemo(() => {
    if (!selectedClass || totalCount == null) return null;
    if (debouncedFilter && filteredCount != null) {
      return t("messages.entityCountFiltered", {
        shown: filteredCount,
        total: totalCount,
      });
    }
    return String(totalCount);
  }, [selectedClass, debouncedFilter, filteredCount, totalCount, t]);

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

              {/* Count badge: "filtered of total" when filtering, just total otherwise */}
              {selectedClass && !entitiesLoading && countLabel && (
                <Chip
                  label={countLabel}
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
            ) : entities.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
                {entityFilter
                  ? t("messages.noEntitiesMatching", { filter: entityFilter })
                  : t("messages.noEntitiesForClass")}
              </Box>
            ) : (
              <Box
                ref={scrollContainerRef}
                onScroll={handleEntityListScroll}
                sx={{
                  flex: 1,
                  overflow: "auto",
                  maxHeight: { xs: 360, md: "none" },
                }}
              >
                <List
                  disablePadding
                  sx={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const entity = entities[virtualRow.index];
                    if (!entity) return null;
                    const isActiveEditing =
                      isEditorEditing && selectedEntity === entity.uri;
                    return (
                      <ListItem
                        key={`${selectedClass}-${entity.uri}`}
                        disablePadding
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
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

                {/* Loading indicator for next page */}
                {isFetchingNextPage && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
              </Box>
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
            warnAutoUri={warnAutoUri}
            warnAutoLabel={warnAutoLabel}
            onEntitySaved={() => {
              // Optionally refetch entities list
            }}
            onEntityDeselected={handleEntityDeselect}
            onEditingChange={(isEditing) => {
              setIsEditorEditing(isEditing);
              onEditingChange?.(isEditing);
            }}
            onRegisterSave={onRegisterSave}
            onRegisterDiscard={onRegisterDiscard}
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
