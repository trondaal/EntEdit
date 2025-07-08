import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  CircularProgress,
  Box,
} from "@mui/material";
import { Language } from "@mui/icons-material";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useAvailableLanguages } from "../hooks/useSparqlQueries";

interface LanguageSelectorProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  config,
  selectedLanguage,
  onLanguageChange,
}) => {
  const { data: languages, isLoading } = useAvailableLanguages(config);

  const handleChange = (event: SelectChangeEvent) => {
    onLanguageChange(event.target.value);
  };

  return (
    <Box
      sx={{
        width: 90,
        minWidth: 90,
        maxWidth: 90,
        display: "flex",
        alignItems: "center",
        //overflow: "hidden"
      }}
    >
      <Language
        sx={{
          mr: 0.5,
          color: "action.active",
          flexShrink: 0,
          fontSize: "1rem",
        }}
      />
      <FormControl
        size="small"
        sx={{
          width: 65,
          minWidth: 65,
          maxWidth: 65,
          flexShrink: 0,
        }}
      >
        <InputLabel sx={{ fontSize: "0.75rem" }}>Language</InputLabel>
        <Select
          value={selectedLanguage}
          label="Language"
          onChange={handleChange}
          disabled={isLoading}
          sx={{
            width: 65,
            minWidth: 65,
            maxWidth: 65,
            fontSize: "0.875rem",
            "& .MuiSelect-select": {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "6px 8px",
            },
          }}
        >
          {isLoading ? (
            <MenuItem disabled>
              <CircularProgress size={16} />
            </MenuItem>
          ) : (
            languages?.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {lang.toUpperCase()}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageSelector;
