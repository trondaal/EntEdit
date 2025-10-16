import React from "react";
import {
  Paper,
  Box,
  Typography,
  List,
  CircularProgress,
  Alert,
} from "@mui/material";
import Expression from "./Expression";
import type { SearchResult } from "../hooks/useSearchQueries";

interface ResultSetProps {
  searchQuery: string;
  searchResults?: SearchResult[];
  searchLoading: boolean;
  searchError: Error | null;
  selectedResult: string | null;
  onSelectResult: (uri: string) => void;
}

const ResultSet: React.FC<ResultSetProps> = ({
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  selectedResult,
  onSelectResult,
}) => {
  return (
    <Paper elevation={1} sx={{ height: "fit-content", minHeight: 700 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" sx={{ display: "flex", alignItems: "center" }}>
          Search Results
          {searchResults && searchQuery && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              ({searchResults.length} found)
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
          Enter a search query to find entities
        </Box>
      ) : searchLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : searchResults?.length === 0 ? (
        <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
          No results found for "{searchQuery}"
        </Box>
      ) : (
        <List sx={{ maxHeight: 600, overflow: "auto" }}>
          {searchResults?.map((result, index) => (
            <Expression
              key={`${result.uri}-${index}`}
              result={result}
              isSelected={selectedResult === result.uri}
              onSelect={onSelectResult}
            />
          ))}
        </List>
      )}
    </Paper>
  );
};

export default ResultSet;
