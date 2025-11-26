import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Language } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("entityEditor");
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
          {primaryLabel || t("messages.noLabel")}
        </Typography>
        {isEditing && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Language />}
            onClick={onEditLabels}
            disabled={!classUri}
            aria-label={t("common:buttons.editLabels", { ns: "common" })}
          >
            {t("common:buttons.editLabels", { ns: "common" })}
          </Button>
        )}
      </Box>
      {!primaryLabel && isEditing && (
        <Typography variant="body2" color="text.secondary">
          {t("messages.noLabels")}
        </Typography>
      )}
    </Box>
  );
};

export default React.memo(EntityLabelsSection);
