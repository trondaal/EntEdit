import React from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import {
  Edit,
  Save,
  Add,
  DeleteForever,
  AccountTree,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface EntityEditorHeaderProps {
  entityUri: string | null;
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
}

const EntityEditorHeader: React.FC<EntityEditorHeaderProps> = ({
  entityUri,
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
}) => {
  const { t } = useTranslation("entityEditor");

  return (
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
        {entityUri ? t("title.edit") : t("title.create")}
      </Typography>

      <Box sx={{ display: "flex", gap: 1 }}>
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
          <>
            <Button
              variant="contained"
              size="small"
              onClick={onEdit}
              startIcon={<Edit />}
              aria-label={t("common:buttons.edit", { ns: "common" })}
            >
              {t("common:buttons.edit", { ns: "common" })}
            </Button>
            {entityUri && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onOpenGraph}
                  component="a"
                  href={graphUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<AccountTree />}
                  color="primary"
                  aria-label={t("common:buttons.graph", { ns: "common" })}
                >
                  {t("common:buttons.graph", { ns: "common" })}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onNew}
                  startIcon={<Add />}
                  color="success"
                  aria-label={t("common:buttons.new", { ns: "common" })}
                >
                  {t("common:buttons.new", { ns: "common" })}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onDelete}
                  startIcon={<DeleteForever />}
                  color="error"
                  aria-label={t("common:buttons.delete", { ns: "common" })}
                >
                  {t("common:buttons.delete", { ns: "common" })}
                </Button>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(EntityEditorHeader);
