import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
} from "@mui/material";
import {
  Edit,
  Save,
  Add,
  DeleteForever,
  AccountTree,
  MoreVert,
  LabelOutlined,
  Code,
  Link as LinkIcon,
  ArticleOutlined,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface EntityEditorHeaderProps {
  entityUri: string | null;
  entityLabel: string | null;
  className: string | null;
  isEditing: boolean;
  saving: boolean;
  uriError: boolean;
  classUri: string;
  graphUrl: string | null;
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onNew: () => void;
  onOpenGraph: (event: React.MouseEvent) => void;
  onEditLabels: () => void;
  onEditUri: () => void;
  onExportTurtle: () => void;
  isDirty: boolean;
}

const EntityEditorHeader: React.FC<EntityEditorHeaderProps> = ({
  entityUri,
  entityLabel,
  className,
  isEditing,
  saving,
  uriError,
  classUri,
  graphUrl,
  onSave,
  onEdit,
  onCancel,
  onDelete,
  onNew,
  onOpenGraph,
  onEditLabels,
  onEditUri,
  onExportTurtle,
  isDirty,
}) => {
  const { t } = useTranslation("entityEditor");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const resolvedClassName = className || t("title.defaultClassName");
  const titleText = entityLabel
    || (entityUri
      ? t("title.edit", { className: resolvedClassName })
      : t("title.create", { className: resolvedClassName }));
  const titleMuted = !entityLabel;

  // Menu is available as soon as a class is selected;
  // items that require a saved entity are individually disabled below.
  const menuDisabled = !classUri;
  const entityActionsDisabled = !entityUri;
  const handleMenuClose = () => setMenuAnchor(null);

  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: "divider",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      {/* Left: label as title + label-edit icon */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flex: 1, mr: 1 }}>
        <Typography
          variant="h6"
          noWrap
          sx={{
            color: "text.primary",
            fontStyle: titleMuted ? "italic" : "normal",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArticleOutlined sx={{ mr: 1 }} />
          {titleText}
        </Typography>
      </Box>

      {/* Right: action buttons */}
      <Box sx={{ display: "flex", gap: 1, flexShrink: 0, alignItems: "center" }}>
        {isEditing ? (
          <>
            <Button
              variant="contained"
              size="small"
              onClick={onSave}
              disabled={saving || uriError || !classUri}
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              aria-label={t("common:buttons.save", { ns: "common" })}
            >
              {saving ? t("common:buttons.saving", { ns: "common" }) : t("common:buttons.save", { ns: "common" })}
            </Button>
            {entityUri && (
              <Button
                variant="outlined"
                size="small"
                onClick={onCancel}
                aria-label={t("common:buttons.cancel", { ns: "common" })}
              >
                {t("common:buttons.cancel", { ns: "common" })}
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={onEdit}
            startIcon={<Edit />}
            disabled={!classUri}
            aria-label={t("common:buttons.edit", { ns: "common" })}
          >
            {t("common:buttons.edit", { ns: "common" })}
          </Button>
        )}

        {/* MoreVert always visible; disabled when no entity is selected */}
        <Tooltip title={menuDisabled ? "" : t("common:buttons.moreActions", { ns: "common" })}>
          <span>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={menuDisabled}
              aria-label={t("common:buttons.moreActions", { ns: "common" })}
              aria-haspopup="true"
            >
              <MoreVert />
            </IconButton>
          </span>
        </Tooltip>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => { handleMenuClose(); onEditUri(); }}
          >
            <ListItemIcon>
              <LinkIcon fontSize="small" sx={{ color: uriError ? "error.main" : undefined }} />
            </ListItemIcon>
            <ListItemText>
              {t(entityUri ? "common:buttons.showUri" : "common:buttons.addUri", { ns: "common" })}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => { handleMenuClose(); onEditLabels(); }}
            disabled={!isEditing}
          >
            <ListItemIcon>
              <LabelOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("common:buttons.editLabels", { ns: "common" })}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => { handleMenuClose(); onNew(); }}
            disabled={entityActionsDisabled}
          >
            <ListItemIcon>
              <Add fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("common:buttons.new", { ns: "common" })}</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={(e) => { handleMenuClose(); onOpenGraph(e); }}
            component="a"
            href={entityActionsDisabled ? undefined : (graphUrl || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            disabled={entityActionsDisabled}
          >
            <ListItemIcon>
              <AccountTree fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("common:buttons.graph", { ns: "common" })}</ListItemText>
          </MenuItem>
          <Tooltip
            title={isDirty ? t("common:buttons.exportTurtleSaveFirst", { ns: "common" }) : ""}
            placement="left"
          >
            <span>
              <MenuItem
                onClick={() => { handleMenuClose(); onExportTurtle(); }}
                disabled={isDirty || entityActionsDisabled}
              >
                <ListItemIcon>
                  <Code fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t("common:buttons.exportTurtle", { ns: "common" })}</ListItemText>
              </MenuItem>
            </span>
          </Tooltip>
          <Divider />
          <MenuItem
            onClick={() => { handleMenuClose(); onDelete(); }}
            disabled={entityActionsDisabled}
            sx={{ color: entityActionsDisabled ? undefined : "error.main" }}
          >
            <ListItemIcon>
              <DeleteForever fontSize="small" sx={{ color: entityActionsDisabled ? undefined : "error.main" }} />
            </ListItemIcon>
            <ListItemText>{t("common:buttons.delete", { ns: "common" })}</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default React.memo(EntityEditorHeader);
