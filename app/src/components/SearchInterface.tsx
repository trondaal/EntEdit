import React, { useState } from "react";
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<'expression' | 'manifestation'>('expression');
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [selectedManifestation, setSelectedManifestation] = useState<string | null>(null);
  const [selectedManifestationResult, setSelectedManifestationResult] = useState<string | null>(null);

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchExpressions(config, searchQuery, selectedLanguage);

  const {
    data: manifestationSearchResults,
    isLoading: manifestationSearchLoading,
    error: manifestationSearchError,
  } = useSearchManifestations(config, searchQuery, selectedLanguage);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedResult(null);
    setSelectedManifestation(null);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedResult(null);
    setSelectedManifestation(null);
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
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
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
              searchQuery={searchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              searchError={searchError as Error | null}
              selectedResult={selectedResult}
              onSelectResult={setSelectedResult}
              config={config}
              selectedManifestationUri={selectedManifestation}
              onManifestationSelect={setSelectedManifestation}
              selectedLanguage={selectedLanguage}
            />
          ) : (
            <ManifestationResultSet
              searchQuery={searchQuery}
              searchResults={manifestationSearchResults}
              searchLoading={manifestationSearchLoading}
              searchError={manifestationSearchError as Error | null}
              selectedResult={selectedManifestationResult}
              onSelectResult={setSelectedManifestationResult}
              config={config}
              selectedLanguage={selectedLanguage}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchInterface;