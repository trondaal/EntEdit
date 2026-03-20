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
import Expression from "./Expression";
import type { ExpressionSearchResult } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ResultSetProps {
  searchQuery: string;
  searchResults: ExpressionSearchResult[];
  searchLoading: boolean;
  searchError: Error | null;
  selectedResult: string | null;
  onSelectResult: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedManifestationUri: string | null;
  onManifestationSelect: (uri: string) => void;
  selectedLanguage: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onFetchNextPage: () => void;
  onEntitySearch: (name: string) => void;
}

const ResultSet: React.FC<ResultSetProps> = ({
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  selectedResult,
  onSelectResult,
  config,
  selectedManifestationUri,
  onManifestationSelect,
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
    <Paper elevation={1} sx={{ height: "fit-content", minHeight: 700 }}>
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

      {searchError && (
        <Alert severity="error" sx={{ m: 2 }}>
          {t("search.searchFailed", { message: searchError.message })}
        </Alert>
      )}

      {!searchQuery ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {t("search.enterSearchQuery")}
        </Box>
      ) : searchLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : searchResults.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          {t("search.noResultsFor", { query: searchQuery })}
        </Box>
      ) : (
        <List sx={{ maxHeight: 600, overflow: "auto" }} onScroll={handleScroll}>
          {searchResults.map((result, index) => (
            <Expression
              key={`${result.uri}-${index}`}
              result={result}
              isSelected={selectedResult === result.uri}
              onSelect={onSelectResult}
              config={config}
              selectedManifestationUri={selectedManifestationUri}
              onManifestationSelect={onManifestationSelect}
              selectedLanguage={selectedLanguage}
              onEntitySearch={onEntitySearch}
              initialExpanded={index < 5 && result.manifestation_count != null && result.manifestation_count <= 2}
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

export default ResultSet;
