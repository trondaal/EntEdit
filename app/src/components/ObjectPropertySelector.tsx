import React from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useEntitiesByRange } from "../hooks/useSparqlQueries";
import { extractUriFragment } from "../utils/labelUtils";

interface ObjectPropertySelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const ObjectPropertySelector: React.FC<ObjectPropertySelectorProps> = ({
  config,
  rangeUri,
  selectedLanguage,
  onSelect,
  onCancel,
}) => {
  const { t } = useTranslation("entityEditor");
  const { data: entities, isLoading } = useEntitiesByRange(
    config,
    rangeUri || "",
    selectedLanguage,
  );

  if (!rangeUri) {
    return (
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: 1,
          borderColor: "warning.main",
          borderRadius: 1,
        }}
      >
        <Typography color="warning.main">
          {t("messages.noRangeSpecified")}
        </Typography>
        <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
          {t("common:buttons.cancel", { ns: "common" })}
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <CircularProgress size={20} />
        <Typography sx={{ ml: 1, display: "inline" }}>
          {t("common:messages.loadingEntities", { ns: "common" })}
        </Typography>
      </Box>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <Box
        sx={{
          mb: 2,
          p: 2,
          border: 1,
          borderColor: "info.main",
          borderRadius: 1,
        }}
      >
        <Typography color="info.main">
          {t("messages.noEntitiesFound", { typeName: extractUriFragment(rangeUri) })}
        </Typography>
        <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
          {t("common:buttons.cancel", { ns: "common" })}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: 1,
        borderColor: "primary.main",
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t("messages.selectEntity")}
      </Typography>
      <Box sx={{ maxHeight: 200, overflow: "auto" }}>
        {entities.map((entity) => (
          <Button
            key={`${rangeUri}-${entity.uri}`}
            fullWidth
            variant="outlined"
            size="small"
            onClick={() => onSelect(entity.uri)}
            sx={{
              mb: 1,
              justifyContent: "flex-start",
              textAlign: "left",
              display: "block",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {entity.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {entity.uri}
            </Typography>
          </Button>
        ))}
      </Box>
      <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
        {t("common:buttons.cancel", { ns: "common" })}
      </Button>
    </Box>
  );
};

export default React.memo(ObjectPropertySelector);
