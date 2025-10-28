import React, { useState } from "react";
import {
  Paper,
  Typography,
  TextField,
  Box,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Search, Clear } from "@mui/icons-material";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useSearchEntities } from "../hooks/useSearchQueries";
import ResultSet from "./ResultSet";

interface SearchInterfaceProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  config,
  selectedLanguage,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [selectedManifestation, setSelectedManifestation] = useState<string | null>(null);

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useSearchEntities(config, searchQuery, selectedLanguage);

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
                Full-Text Search
              </Typography>

              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search entities using full-text search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                InputProps={{
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
                }}
              />
            </Box>

            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Enter search terms to find entities using GraphDB's Lucene connector.
                Search will be performed across names and titles.
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Search Results Section */}
        <Box sx={{ flex: "1 1 600px", minWidth: 600, alignSelf: "flex-start" }}>
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
        </Box>
      </Box>
    </Box>
  );
};

export default SearchInterface;