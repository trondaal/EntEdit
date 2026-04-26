import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import type { SparqlEndpointConfig, RdfProperty, OrderedValue } from "../types/sparql";
import { getGraphVisualizationUrl } from "../utils/graphUtils";
import {
  useWEMIProperties,
  useAgentProperties,
  useRelatedWorkProperties,
  useRelatedExpressionProperties,
  useRelatedManifestationProperties
} from "../hooks/useRelationshipQueries";
import LabelManager from "./LabelManager";
import TurtleExportDialog from "./TurtleExportDialog";
import EntityEditorHeader from "./EntityEditorHeader";
import DataPropertiesSection from "./DataPropertiesSection";
import ObjectPropertyGroup from "./ObjectPropertyGroup";
import { isValidUri, formatLabel } from "../utils/labelUtils";
import { useTurtleExportQuery } from "../hooks/useTurtleExportQuery";
import { EntityLabelsProvider, useEntityLabels, type EntityLabelsMap } from "../hooks/useEntityLabels";
import { useEntityQuery } from "../hooks/useEntityQueries";
import { useEntityMutations } from "../hooks/useEntityMutations";

// Stable empty map reference to avoid re-rendering context consumers while the
// batched labels query is in flight or returns no URIs.
const EMPTY_ENTITY_LABELS: EntityLabelsMap = new Map();

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
  warnAutoUri: boolean;
  warnAutoLabel: boolean;
  onEntitySaved: () => void;
  onEntityDeselected?: () => void;
  onEditingChange?: (isEditing: boolean) => void;
  onRegisterSave?: (handler: (() => Promise<void>) | null) => void;
  onRegisterDiscard?: (handler: (() => void) | null) => void;
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
  warnAutoUri,
  warnAutoLabel,
  onEntitySaved,
  onEntityDeselected,
  onEditingChange,
  onRegisterSave,
  onRegisterDiscard,
}) => {
  const { t } = useTranslation("entityEditor");
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

  const [entityData, setEntityData] = useState<Record<string, OrderedValue[]>>({});
  const [isEditing, setIsEditing] = useState(!entityUri);
  // isDirty tracks actual user changes (separate from isEditing which controls form interactivity)
  // For new entities isEditing starts true but isDirty only becomes true after the user makes a change
  const [isDirty, setIsDirty] = useState(false);

  // Notify parent whenever dirty state changes (not edit mode, since new entities start in edit mode)
  useEffect(() => {
    onEditingChange?.(isDirty);
  }, [isDirty, onEditingChange]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [customEntityUri, setCustomEntityUri] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [saveWarningDialogOpen, setSaveWarningDialogOpen] = useState(false);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [turtleDialogOpen, setTurtleDialogOpen] = useState(false);
  const [entityLabels, setEntityLabels] = useState<
    Array<{ id: string; value: string; language: string }>
  >([]);

  const { data: existingEntity, isLoading: entityLoading } = useEntityQuery(
    config,
    entityUri,
  );

  // Mirror isEditing/isDirty into refs so the sync effect below can read
  // committed values without depending on them — we want the effect to
  // re-run only when server data or the selected entity changes, not when
  // the user toggles edit mode.
  const isEditingRef = useRef(isEditing);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isEditingRef.current = isEditing;
    isDirtyRef.current = isDirty;
  });

  // Sync local form state with the loaded server entity. Initialization-from-source
  // pattern, not derivable during render because we also clear edit/dirty flags.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (existingEntity) {
      // Don't overwrite in-progress edits when cache invalidation refreshes the data
      if (isEditingRef.current && isDirtyRef.current) return;
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

  // Collect all URI-typed object property values so we can batch-fetch their
  // rdfs:label in a single SPARQL query instead of firing one query per value
  // (the old pattern in ObjectPropertyValue). The resolved map is provided
  // through EntityLabelsProvider and consumed by ObjectPropertyValue.
  const relatedEntityUris = useMemo(() => {
    const uris: string[] = [];
    for (const [property, values] of Object.entries(entityData)) {
      const isObjectProp = objectPropertyUris.has(property);
      for (const v of values) {
        if ((isObjectProp || v.isUri) && v.value) uris.push(v.value);
      }
    }
    return uris;
  }, [entityData, objectPropertyUris]);

  const { data: relatedEntityLabels } = useEntityLabels(
    config,
    relatedEntityUris,
    selectedLanguage,
  );

  // Called by useEntityMutations on successful save. Resets the create form
  // for new entities, or flips out of edit mode for existing ones, then bubbles
  // up to the parent so the entity list can refresh.
  const handleSaveSuccess = useCallback(
    ({ isNew }: { isNew: boolean; savedEntityUri: string }) => {
      if (isNew) {
        setEntityData({});
        setCustomEntityUri("");
        setSelectedProperty("");
        setIsEditing(true);
        setIsDirty(false);
        setEntityLabels([]);
      } else {
        setIsEditing(false);
        setIsDirty(false);
      }
      onEntitySaved();
    },
    [onEntitySaved],
  );

  // Called by useEntityMutations on successful delete.
  const handleDeleteSuccess = useCallback(() => {
    setDeleteDialogOpen(false);
    onEntityDeselected?.();
    onEntitySaved();
  }, [onEntityDeselected, onEntitySaved]);

  const {
    handleSave,
    handleDelete,
    saving,
    deleting,
    saveError,
    deleteError,
    clearSaveError,
  } = useEntityMutations({
    config,
    classUri,
    entityUri,
    customEntityUri,
    entityData,
    entityLabels,
    existingEntity,
    properties,
    objectPropertyUris,
    onSaveSuccess: handleSaveSuccess,
    onDeleteSuccess: handleDeleteSuccess,
  });

  // Reset the create form when the user switches class (only for new entities).
  // Placed after useEntityMutations so clearSaveError is in scope.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- form reset on class change
  useEffect(() => {
    if (!entityUri) {
      setEntityData({});
      setCustomEntityUri("");
      setSelectedProperty("");
      clearSaveError();
      setIsEditing(true);
      setIsDirty(false);
      setEntityLabels([]);
    }
  }, [classUri, entityUri, clearSaveError]);

  const requestSave = useCallback(() => {
    // Only check warnings for new entities (existing entities already have URIs and labels)
    if (!entityUri) {
      const willAutoUri = warnAutoUri && !customEntityUri.trim();
      const willAutoLabel = warnAutoLabel && !entityLabels.some((l) => l.value.trim());
      if (willAutoUri || willAutoLabel) {
        setSaveWarningDialogOpen(true);
        return;
      }
    }
    handleSave();
  }, [entityUri, warnAutoUri, warnAutoLabel, customEntityUri, entityLabels, handleSave]);

  // Register/unregister handleSave with the parent so the header Refresh
  // button can offer a "Save & refresh" option when there are unsaved edits.
  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(isDirty ? handleSave : null);
    return () => onRegisterSave(null);
  }, [isDirty, handleSave, onRegisterSave]);

  const getGraphUrl = useMemo(
    () => entityUri ? getGraphVisualizationUrl(config.url, entityUri) : null,
    [entityUri, config.url]
  );

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
        const maxOrder = currentValues.length > 0
          ? Math.max(...currentValues.map((v) => v.order)) + 1
          : 0;
        return {
          ...prev,
          [propertyUri]: [...currentValues, { value: "", order: maxOrder }],
        };
      });
      setIsDirty(true);
    }
  }, [isEditing]);

  const addObjectProperty = useCallback((propertyUri: string, entityUri: string) => {
    if (propertyUri && entityUri) {
      setEntityData((prev) => {
        const currentValues = prev[propertyUri] || [];
        const maxOrder = currentValues.length > 0
          ? Math.max(...currentValues.map((v) => v.order)) + 1
          : 0;
        return {
          ...prev,
          [propertyUri]: [...currentValues, { value: entityUri, order: maxOrder, isUri: true }],
        };
      });
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
      values[index] = { ...values[index], value };
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const reorderPropertyValues = useCallback((property: string, fromIndex: number, toIndex: number) => {
    setEntityData((prev) => {
      const values = [...(prev[property] || [])];
      const [moved] = values.splice(fromIndex, 1);
      values.splice(toIndex, 0, moved);
      // Re-assign sequential order values
      const reordered = values.map((v, i) => ({ ...v, order: i }));
      return {
        ...prev,
        [property]: reordered,
      };
    });
    setIsDirty(true);
  }, []);

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
        requestSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, requestSave]);

  // Additional handlers for the header component
  const handleEdit = useCallback(() => setIsEditing(true), []);

  const performCancel = useCallback(() => {
    setIsEditing(false);
    setIsDirty(false);
    setEntityData(existingEntity?.data || {});
    setEntityLabels(existingEntity?.labels || []);
    setDiscardDialogOpen(false);
  }, [existingEntity]);

  // Register/unregister discard handler so the header Refresh button's
  // "Discard & refresh" option can drop unsaved edits before invalidation.
  useEffect(() => {
    if (!onRegisterDiscard) return;
    onRegisterDiscard(isDirty ? performCancel : null);
    return () => onRegisterDiscard(null);
  }, [isDirty, performCancel, onRegisterDiscard]);

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
  const [uriDialogOpen, setUriDialogOpen] = useState(false);
  const handleEditUri = useCallback(() => setUriDialogOpen(true), []);

  // Turtle export
  const { turtle, isLoading: turtleLoading, error: turtleError, refetch: fetchTurtle } = useTurtleExportQuery(config, entityUri);
  const handleExportTurtle = useCallback(() => {
    setTurtleDialogOpen(true);
    void fetchTurtle();
  }, [fetchTurtle]);

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
        onSave={requestSave}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onDelete={handleDeleteDialog}
        onNew={handleNew}
        onOpenGraph={handleOpenGraph}
        onEditLabels={handleEditLabels}
        onEditUri={handleEditUri}
        onExportTurtle={handleExportTurtle}
        isDirty={isDirty}
      />

      <Box sx={{ p: 3, flex: 1, overflow: "auto" }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Tooltip
          title={!classUri ? t("messages.selectClass") : ""}
          followCursor
          disableHoverListener={!!classUri}
        >
          <Box>
            <Box
              sx={{
                opacity: classUri ? 1 : 0.45,
                pointerEvents: classUri ? "auto" : "none",
                transition: "opacity 0.2s",
              }}
            >
        <DataPropertiesSection
          entityData={entityData}
          properties={properties}
          isEditing={isEditing}
          classUri={classUri}
          selectedProperty={selectedProperty}
          onPropertySelect={handlePropertySelect}
          onUpdateValue={updatePropertyValue}
          onRemoveValue={removePropertyValue}
          onReorderValues={reorderPropertyValues}
          getPropertyLabel={getPropertyLabel}
        />

        <EntityLabelsProvider value={relatedEntityLabels ?? EMPTY_ENTITY_LABELS}>
          {objectPropertySections.map((section) => (
            <ObjectPropertyGroup
              key={section.key}
              config={config}
              sectionTitle={t(section.sectionTitleKey)}
              sectionKey={section.key}
              entityUri={entityUri}
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
              onReorderValues={reorderPropertyValues}
              onAddProperty={addObjectProperty}
            />
          ))}
        </EntityLabelsProvider>
            </Box>
          </Box>
        </Tooltip>
      </Box>

      {/* URI Dialog */}
      <Dialog
        open={uriDialogOpen}
        onClose={() => setUriDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("common:labels.identifier", { ns: "common" })}</DialogTitle>
        <DialogContent>
          {entityUri ? (
            <Box
              sx={{
                mt: 1,
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
                sx={{ flex: 1, color: "text.secondary", fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}
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
            <TextField
              fullWidth
              autoFocus
              label={t("common:labels.identifier", { ns: "common" })}
              value={customEntityUri}
              onChange={(e) => setCustomEntityUri(e.target.value)}
              disabled={!isEditing}
              error={!!uriError}
              helperText={t("placeholders.enterUri")}
              sx={{ mt: 1 }}
              size="small"
              placeholder={t("placeholders.enterUri")}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUriDialogOpen(false)}>
            {t("common:buttons.close", { ns: "common" })}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Turtle Export Dialog */}
      <TurtleExportDialog
        open={turtleDialogOpen}
        onClose={() => setTurtleDialogOpen(false)}
        turtle={turtle}
        isLoading={turtleLoading}
        error={turtleError}
        entityUri={entityUri}
      />

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

      {/* Save Warning Dialog for auto-generated URI/label */}
      <Dialog
        open={saveWarningDialogOpen}
        onClose={() => setSaveWarningDialogOpen(false)}
        aria-labelledby="save-warning-dialog-title"
        aria-describedby="save-warning-dialog-description"
      >
        <DialogTitle id="save-warning-dialog-title">
          {t("dialogs.saveWarning.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="save-warning-dialog-description">
            {(() => {
              const willAutoUri = warnAutoUri && !entityUri && !customEntityUri.trim();
              const willAutoLabel = warnAutoLabel && !entityLabels.some((l) => l.value.trim());
              if (willAutoUri && willAutoLabel) return t("dialogs.saveWarning.messageBoth");
              if (willAutoUri) return t("dialogs.saveWarning.messageUri");
              return t("dialogs.saveWarning.messageLabel");
            })()}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveWarningDialogOpen(false)}>
            {t("common:buttons.cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={() => {
              setSaveWarningDialogOpen(false);
              handleSave();
            }}
            variant="contained"
          >
            {t("dialogs.saveWarning.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EntityEditor;
