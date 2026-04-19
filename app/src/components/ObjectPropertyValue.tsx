import React from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Delete, Tag } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { extractUriFragment } from "../utils/labelUtils";
import { useEntityLabel } from "../hooks/useEntityLabels";

interface ObjectPropertyValueProps {
  // Retained so the prop surface stays stable for callers and future features
  // (e.g. inline link to the target entity's endpoint), even though labels are
  // now resolved via the batched EntityLabelsContext rather than a per-value
  // SPARQL query.
  config: SparqlEndpointConfig;
  value: string;
  rangeUri?: string;
  isEditing: boolean;
  selectedLanguage: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

const ObjectPropertyValue: React.FC<ObjectPropertyValueProps> = ({
  value,
  isEditing,
  onRemove,
}) => {
  const { t } = useTranslation("common");

  // Label is provided by the parent's batched useEntityLabels query; fall back
  // to the URI fragment until the batch resolves or for URIs without rdfs:label.
  const label = useEntityLabel(value);
  const displayLabel = label || extractUriFragment(value);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          flex: 1,
          p: 0.75,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="body2">
            {displayLabel}
          </Typography>
          <Tooltip title={value} placement="bottom-start">
            <Tag sx={{ fontSize: "0.875rem", color: "text.disabled", flexShrink: 0 }} />
          </Tooltip>
        </Box>
      </Box>
      {isEditing && (
        <IconButton
          size="small"
          onClick={onRemove}
          color="error"
          sx={{ p: 0.5 }}
          aria-label={t("buttons.remove")}
        >
          <Delete fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export default React.memo(ObjectPropertyValue);
