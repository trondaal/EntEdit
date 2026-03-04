import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { Search, Tag } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  useInfiniteEntitiesByRange,
  useEntityCountByRange,
} from "../hooks/useEntityQueries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
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

const ITEM_HEIGHT = 42;

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
  const debouncedFilter = useDebouncedValue(filter, 300);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    data: entitiesData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteEntitiesByRange(
    config,
    rangeUri || "",
    selectedLanguage,
    debouncedFilter,
  );

  const { data: totalCount } = useEntityCountByRange(
    config,
    rangeUri || "",
    selectedLanguage,
    "",
  );

  const { data: filteredCount } = useEntityCountByRange(
    config,
    rangeUri || "",
    selectedLanguage,
    debouncedFilter,
  );

  // Flatten pages
  const entities = useMemo(
    () => entitiesData?.pages.flat() ?? [],
    [entitiesData],
  );

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 8,
  });

  // Fetch next page when user scrolls near the bottom of the container.
  // Uses a direct onScroll handler instead of watching virtualizer state,
  // because the scroll container is conditionally rendered and may not be
  // connected when the virtualizer initialises.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < 200 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
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

  // Build count label
  const countLabel = (() => {
    if (totalCount == null) return null;
    if (debouncedFilter && filteredCount != null) {
      return `${filteredCount} / ${totalCount}`;
    }
    return String(totalCount);
  })();

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
      {/* Header row: prompt label + count + filter field */}
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
        {countLabel && (
          <Chip
            label={countLabel}
            size="small"
            variant="outlined"
            sx={{ flexShrink: 0 }}
          />
        )}
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
      {entities.length === 0 && !isFetchingNextPage ? (
        <Box sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">
            {filter
              ? t("messages.noEntitiesMatchFilter")
              : t("messages.noEntitiesFound", { typeName: extractUriFragment(rangeUri) })}
          </Typography>
        </Box>
      ) : (
        <Box
          ref={scrollContainerRef}
          onScroll={handleScroll}
          sx={{ maxHeight: 280, overflow: "auto" }}
        >
          <List
            disablePadding
            sx={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entity = entities[virtualRow.index];
              if (!entity) return null;
              return (
                <ListItem
                  key={`${rangeUri}-${entity.uri}`}
                  disablePadding
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                >
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
              );
            })}
          </List>

          {/* Loading indicator for next page */}
          {isFetchingNextPage && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
              <CircularProgress size={16} />
            </Box>
          )}
        </Box>
      )}

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
