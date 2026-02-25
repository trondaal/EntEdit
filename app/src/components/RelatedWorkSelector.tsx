import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
} from "@mui/material";
import { Search, Tag } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useEntitiesByRange } from "../hooks/useSparqlQueries";
import { extractUriFragment } from "../utils/labelUtils";

interface RelatedWorkSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const RelatedWorkSelector: React.FC<RelatedWorkSelectorProps> = ({
  config,
  rangeUri,
  selectedLanguage,
  onSelect,
  onCancel,
}) => {
  const { t } = useTranslation("entityEditor");
  const [filter, setFilter] = useState("");
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
        {t("messages.selectRelatedWork")}
      </Typography>
      <TextField
        size="small"
        fullWidth
        placeholder={t("placeholders.filterEntities")}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        sx={{ mb: 1 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: "action.active" }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ maxHeight: 320, overflow: "auto" }}>
        {entities
          .filter((entity) =>
            entity.label.toLowerCase().includes(filter.toLowerCase()),
          )
          .map((entity) => (
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
            }}
          >
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {entity.label}
            </Typography>
            <Tooltip title={entity.uri} placement="bottom-start">
              <Tag sx={{ fontSize: "0.875rem", color: "text.disabled", flexShrink: 0, ml: 0.5 }} />
            </Tooltip>
          </Button>
        ))}
      </Box>
      <Button variant="outlined" onClick={onCancel} sx={{ mt: 1 }}>
        {t("common:buttons.cancel", { ns: "common" })}
      </Button>
    </Box>
  );
};

export default React.memo(RelatedWorkSelector);
