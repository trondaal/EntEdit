import React, { useCallback, useMemo } from "react";
import {
  Paper,
  Box,
  Typography,
  List,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { EntitySearchHandler } from "../utils/searchLink";
import ManifestationSearchResult from "./ManifestationSearchResult";
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ManifestationResultSetProps {
  searchQuery: string;
  /** Category filters are applied; results are shown without search text too */
  filtered: boolean;
  /** Hits for the whole search, across all pages */
  totalCount: number;
  /** No exact hits: the results match similar spellings */
  fuzzy: boolean;
  /** Publications of a followed link (containing the linked expression or work), shown first */
  linked?: ManifestationSearchResultType[];
  linkedLoading?: boolean;
  searchResults: ManifestationSearchResultType[];
  searchLoading: boolean;
  searchError: Error | null;
  onSelectResult: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onEntitySearch: EntitySearchHandler;
}

const ManifestationResultSet: React.FC<ManifestationResultSetProps> = ({
  searchQuery,
  filtered,
  linked = [],
  linkedLoading = false,
  searchResults,
  totalCount,
  fuzzy,
  searchLoading,
  searchError,
  onSelectResult,
  config,
  selectedLanguage,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  // The text search finds the linked publications too; list them once, first
  const otherResults = useMemo(() => {
    const linkedUris = new Set(linked.map((entry) => entry.uri));
    return searchResults.filter((result) => !linkedUris.has(result.uri));
  }, [linked, searchResults]);
  const hasAnything = linked.length > 0 || otherResults.length > 0;
  const sectionHeading = (text: string) => (
    <Typography
      variant="overline"
      component="h3"
      color="text.secondary"
      sx={{ display: "block", px: 2, pt: 1, lineHeight: 2 }}
    >
      {text}
    </Typography>
  );

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
          {t("search.enterSearchQueryManifestations")}
        </Box>
      ) : searchError ? null : searchLoading || linkedLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : !hasAnything ? (
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
          {linked.length > 0 && sectionHeading(t("search.followedLink"))}
          {linked.map((result) => (
            <ManifestationSearchResult
              key={`linked-${result.uri}`}
              result={result}
              onSelect={onSelectResult}
              selectedLanguage={selectedLanguage}
              config={config}
              onEntitySearch={onEntitySearch}
            />
          ))}
          {linked.length > 0 && otherResults.length > 0 && sectionHeading(t("search.otherResults"))}
          {otherResults.map((result, index) => (
            <ManifestationSearchResult
              key={`${result.uri}-${index}`}
              result={result}
              onSelect={onSelectResult}
              selectedLanguage={selectedLanguage}
              config={config}
              onEntitySearch={onEntitySearch}
            />
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

export default ManifestationResultSet;
