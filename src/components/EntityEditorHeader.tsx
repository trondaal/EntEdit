import React from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import {
  Edit,
  Save,
  Add,
  DeleteForever,
  AccountTree,
} from "@mui/icons-material";

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
        {entityUri ? "Edit Entity" : "Create New Entity"}
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
              aria-label="Save entity"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            {entityUri && (
              <Button
                variant="outlined"
                size="small"
                onClick={onCancel}
                aria-label="Cancel editing"
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
              onClick={onEdit}
              startIcon={<Edit />}
              aria-label="Edit entity"
            >
              Edit
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
                  aria-label="View entity graph"
                >
                  Graph
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onNew}
                  startIcon={<Add />}
                  color="success"
                  aria-label="Create new entity"
                >
                  New
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onDelete}
                  startIcon={<DeleteForever />}
                  color="error"
                  aria-label="Delete entity"
                >
                  Delete
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
