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
  selectedResult: string | null;
  onSelectResult: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
}

const ManifestationResultSet: React.FC<ManifestationResultSetProps> = ({
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  selectedResult,
  onSelectResult,
  config,
  selectedLanguage,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
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
    <Paper elevation={1} sx={{ height: "fit-content", minHeight: 700 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center" }}>
          {t("search.searchResults")}
          {searchResults.length > 0 && searchQuery && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              ({searchResults.length}{hasNextPage ? "+" : ""} found)
            </Typography>
          )}
        </Typography>
      </Box>

      {searchError && (
        <Alert severity="error" sx={{ m: 2 }}>
          Search failed: {searchError.message}
        </Alert>
      )}

      {!searchQuery ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          Enter a search query to find manifestations
        </Box>
      ) : searchLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : searchResults.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          No results found for "{searchQuery}"
        </Box>
      ) : (
        <List sx={{ maxHeight: 600, overflow: "auto" }} onScroll={handleScroll}>
          {searchResults.map((result, index) => (
            <ManifestationSearchResult
              key={`${result.uri}-${index}`}
              result={result}
              isSelected={selectedResult === result.uri}
              onSelect={onSelectResult}
              selectedLanguage={selectedLanguage}
              config={config}
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
