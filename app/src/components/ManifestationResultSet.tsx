import React, { useCallback } from "react";
import {
  Paper,
  Box,
  Typography,
  List,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import ManifestationSearchResult from "./ManifestationSearchResult";
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ManifestationResultSetProps {
  searchQuery: string;
  searchResults: ManifestationSearchResultType[];
  searchLoading: boolean;
  searchError: Error | null;
  onSelectResult: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onEntitySearch: (name: string) => void;
}

const ManifestationResultSet: React.FC<ManifestationResultSetProps> = ({
  searchQuery,
  searchResults,
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
          {searchResults.length > 0 && searchQuery && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              ({hasNextPage
                ? t("search.foundCountMore", { count: searchResults.length })
                : t("search.foundCount", { count: searchResults.length })})
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

      {!searchQuery ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {t("search.enterSearchQueryManifestations")}
        </Box>
      ) : searchError ? null : searchLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : searchResults.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {t("search.noResultsFor", { query: searchQuery })}
        </Box>
      ) : (
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
      )}
    </Paper>
  );
};

export default ManifestationResultSet;
