import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Language } from "@mui/icons-material";
import { getPrimaryLabel } from "../utils/labelUtils";

interface EntityLabelsSectionProps {
  entityLabels: Array<{ id: string; value: string; language: string }>;
  selectedLanguage: string;
  isEditing: boolean;
  classUri: string;
  onEditLabels: () => void;
}

const EntityLabelsSection: React.FC<EntityLabelsSectionProps> = ({
  entityLabels,
  selectedLanguage,
  isEditing,
  classUri,
  onEditLabels,
}) => {
  const primaryLabel = getPrimaryLabel(entityLabels, selectedLanguage);

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography variant="h6" color="primary">
          {primaryLabel || "No label"}
        </Typography>
        {isEditing && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Language />}
            onClick={onEditLabels}
            disabled={!classUri}
            aria-label="Edit entity labels"
          >
            Edit Labels
          </Button>
        )}
      </Box>
      {!primaryLabel && isEditing && (
        <Typography variant="body2" color="text.secondary">
          This entity has no labels. Click "Edit Labels" to add one.
        </Typography>
      )}
    </Box>
  );
};

export default React.memo(EntityLabelsSection);
