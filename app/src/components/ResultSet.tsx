import React, { useCallback, type ReactNode } from "react";
import {
  Paper,
  Box,
  Typography,
  List,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";

/** Result list of a search tab; each tab renders its own kind of result. */
interface ResultSetProps<T extends { uri: string }> {
  searchQuery: string;
  /** Category filters are applied; results are shown without search text too */
  filtered: boolean;
  /** Hits for the whole search, across all pages */
  totalCount: number;
  /** No exact hits: the results match similar spellings */
  fuzzy: boolean;
  searchResults: T[];
  searchLoading: boolean;
  searchError: Error | null;
  /** Shown before anything is searched for */
  emptyPrompt: string;
  renderResult: (result: T) => ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
}

const ResultSet = <T extends { uri: string }>({
  searchQuery,
  filtered,
  searchResults,
  totalCount,
  fuzzy,
  searchLoading,
  searchError,
  emptyPrompt,
  renderResult,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
}: ResultSetProps<T>) => {
  const { t } = useTranslation();

  // Fetch next page when user scrolls near the bottom
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLUListElement>) => {
      const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < 300 && hasNextPage && !isFetchingNextPage) {
        onFetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, onFetchNextPage],
  );

  return (
    <Paper
      elevation={1}
      sx={{
        height: { xs: "auto", md: "100%" },
        display: "flex",
        flexDirection: "column",
        overflow: { xs: "visible", md: "hidden" },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center" }}>
          {t("search.searchResults")}
          {searchResults.length > 0 && (searchQuery || filtered) && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              ({t("search.foundCount", { count: totalCount })})
            </Typography>
          )}
        </Typography>
      </Box>

      <Box sx={{ height: 8, flexShrink: 0, bgcolor: "background.default" }} />

      {searchError && (
        <Alert severity="error" sx={{ m: 2 }}>
          {t("search.searchFailed")}
        </Alert>
      )}

      {!searchQuery && !filtered ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {emptyPrompt}
        </Box>
      ) : searchError ? null : searchLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : searchResults.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {!searchQuery
            ? t("search.noResultsForFilters")
            : filtered
              ? t("search.noResultsForWithFilters", { query: searchQuery })
              : t("search.noResultsFor", { query: searchQuery })}
        </Box>
      ) : (
        <>
        {fuzzy && (
          <Alert severity="info" sx={{ mx: 2, mb: 1 }}>
            {t("search.similarSpellings", { query: searchQuery })}
          </Alert>
        )}
        <List
          disablePadding
          sx={{
            flex: 1,
            overflow: "auto",
            maxHeight: { xs: 600, md: "none" },
            bgcolor: "background.default",
            pb: 1,
          }}
          onScroll={handleScroll}
        >
          {searchResults.map((result, index) => (
            <React.Fragment key={`${result.uri}-${index}`}>{renderResult(result)}</React.Fragment>
          ))}

          {/* Loading indicator for next page */}
          {isFetchingNextPage && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </List>
        </>
      )}
    </Paper>
  );
};

export default ResultSet;
