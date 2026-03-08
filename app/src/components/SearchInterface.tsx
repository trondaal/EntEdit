import React, { useState, useMemo } from "react";
import {
  Paper,
  Typography,
  TextField,
  Box,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import { Search, Clear } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useSearchExpressions, useSearchManifestations } from "../hooks/useSearchQueries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import ResultSet from "./ResultSet";
import ManifestationResultSet from "./ManifestationResultSet";

interface SearchInterfaceProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  config,
  selectedLanguage,
}) => {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchMode, setSearchMode] = useState<'expression' | 'manifestation'>('expression');
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [selectedManifestation, setSelectedManifestation] = useState<string | null>(null);
  const [selectedManifestationResult, setSelectedManifestationResult] = useState<string | null>(null);

  // Debounce the search query to avoid firing expensive SPARQL queries on every keystroke
  const debouncedQuery = useDebouncedValue(searchInput, 500);

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
    hasNextPage: searchHasNextPage,
    isFetchingNextPage: searchIsFetchingNextPage,
    fetchNextPage: searchFetchNextPage,
  } = useSearchExpressions(config, debouncedQuery, selectedLanguage);

  const {
    data: manifestationSearchData,
    isLoading: manifestationSearchLoading,
    error: manifestationSearchError,
    hasNextPage: manifestationHasNextPage,
    isFetchingNextPage: manifestationIsFetchingNextPage,
    fetchNextPage: manifestationFetchNextPage,
  } = useSearchManifestations(config, debouncedQuery, selectedLanguage);

  // Flatten infinite query pages into flat arrays
  const searchResults = useMemo(
    () => searchData?.pages.flat() ?? [],
    [searchData],
  );

  const manifestationSearchResults = useMemo(
    () => manifestationSearchData?.pages.flat() ?? [],
    [manifestationSearchData],
  );

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setSelectedResult(null);
    setSelectedManifestation(null);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSelectedResult(null);
    setSelectedManifestation(null);
  };

  const handleEntitySearch = (name: string) => {
    setSearchInput(`"${name}"`);
    setSelectedResult(null);
    setSelectedManifestation(null);
    setSelectedManifestationResult(null);
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* Search Input Section */}
        <Box sx={{ flex: "1 1 400px", minWidth: 400, alignSelf: "flex-start" }}>
          <Paper elevation={1} sx={{ height: "fit-content", minHeight: 200 }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", mb: 2 }}
              >
                <Search sx={{ mr: 1 }} />
                {t("search.fullTextSearch")}
              </Typography>

              {/* Search Mode Tabs */}
              <Tabs
                value={searchMode === 'expression' ? 0 : 1}
                onChange={(_, newValue) => setSearchMode(newValue === 0 ? 'expression' : 'manifestation')}
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label={t("search.expressionSearch")} />
                <Tab label={t("search.manifestationSearch")} />
              </Tabs>

              <TextField
                fullWidth
                variant="outlined"
                placeholder={t("search.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleClearSearch}
                          edge="end"
                          size="small"
                        >
                          <Clear />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t("search.searchHelp")}
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Search Results Section */}
        <Box sx={{ flex: "1 1 600px", minWidth: 600, alignSelf: "flex-start" }}>
          {searchMode === 'expression' ? (
            <ResultSet
              searchQuery={debouncedQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              searchError={searchError as Error | null}
              selectedResult={selectedResult}
              onSelectResult={setSelectedResult}
              config={config}
              selectedManifestationUri={selectedManifestation}
              onManifestationSelect={setSelectedManifestation}
              selectedLanguage={selectedLanguage}
              hasNextPage={searchHasNextPage}
              isFetchingNextPage={searchIsFetchingNextPage}
              onFetchNextPage={searchFetchNextPage}
              onEntitySearch={handleEntitySearch}
            />
          ) : (
            <ManifestationResultSet
              searchQuery={debouncedQuery}
              searchResults={manifestationSearchResults}
              searchLoading={manifestationSearchLoading}
              searchError={manifestationSearchError as Error | null}
              selectedResult={selectedManifestationResult}
              onSelectResult={setSelectedManifestationResult}
              config={config}
              selectedLanguage={selectedLanguage}
              hasNextPage={manifestationHasNextPage}
              isFetchingNextPage={manifestationIsFetchingNextPage}
              onFetchNextPage={manifestationFetchNextPage}
              onEntitySearch={handleEntitySearch}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchInterface;
