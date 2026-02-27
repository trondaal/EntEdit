import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { Search, Tag } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useEntitiesByRange } from "../hooks/useSparqlQueries";
import { extractUriFragment } from "../utils/labelUtils";

interface EntityPickerPanelProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  promptLabel: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const EntityPickerPanel: React.FC<EntityPickerPanelProps> = ({
  config,
  rangeUri,
  selectedLanguage,
  promptLabel,
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

  const filtered = entities.filter((entity) =>
    entity.label.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Box
      sx={{
        mb: 2,
        border: 1,
        borderColor: "primary.main",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      {/* Header row: prompt label + filter field */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>
          {promptLabel}
        </Typography>
        <TextField
          size="small"
          placeholder={t("placeholders.filterEntities")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ flex: 1 }}
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
      </Box>

      {/* Entity list */}
      <List disablePadding sx={{ maxHeight: 280, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">{t("messages.noEntitiesMatchFilter")}</Typography>
          </Box>
        ) : (
          filtered.map((entity) => (
            <ListItem key={`${rangeUri}-${entity.uri}`} disablePadding>
              <ListItemButton onClick={() => onSelect(entity.uri)}>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {entity.label}
                      </Typography>
                      <Tooltip title={entity.uri} placement="bottom-start">
                        <Tag
                          sx={{
                            fontSize: "0.875rem",
                            color: "text.disabled",
                            flexShrink: 0,
                          }}
                        />
                      </Tooltip>
                    </Box>
                  }
                  disableTypography
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>

      {/* Footer: cancel */}
      <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: "divider" }}>
        <Button size="small" onClick={onCancel}>
          {t("common:buttons.cancel", { ns: "common" })}
        </Button>
      </Box>
    </Box>
  );
};

export default React.memo(EntityPickerPanel);
