import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
  CircularProgress,
  Box,
} from '@mui/material';
import { Language } from '@mui/icons-material';
import type { SparqlEndpointConfig } from '../types/sparql';
import { useAvailableLanguages } from '../hooks/useSparqlQueries';

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
    <Box sx={{ minWidth: 120, display: 'flex', alignItems: 'center' }}>
      <Language sx={{ mr: 1, color: 'action.active' }} />
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Language</InputLabel>
        <Select
          value={selectedLanguage}
          label="Language"
          onChange={handleChange}
          disabled={isLoading}
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