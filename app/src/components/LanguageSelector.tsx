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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { data: languages, isLoading } = useAvailableLanguages(config);

  const handleChange = (event: SelectChangeEvent) => {
    onLanguageChange(event.target.value);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
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
          minWidth: 60,
        }}
      >
        <InputLabel sx={{ fontSize: "0.75rem" }}>{t("labels.language")}</InputLabel>
        <Select
          value={selectedLanguage}
          label={t("labels.language")}
          onChange={handleChange}
          disabled={isLoading}
          sx={{
            fontSize: "0.875rem",
            "& .MuiSelect-select": {
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
