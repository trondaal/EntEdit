import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  Collapse,
  IconButton,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import type { SearchResult } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import ManifestationList from "./ManifestationList";

interface ExpressionProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedManifestationUri: string | null;
  onManifestationSelect: (uri: string) => void;
  selectedLanguage: string;
}

const Expression: React.FC<ExpressionProps> = ({
  result,
  isSelected,
  onSelect,
  config,
  selectedManifestationUri,
  onManifestationSelect,
  selectedLanguage,
}) => {
  const [manifestationsExpanded, setManifestationsExpanded] = useState(false);

  // Determine if worktitle should be shown (different from expressiontitle)
  const showWorkTitle = result.worktitle && result.worktitle !== result.expressiontitle;

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const handleToggleManifestations = (e: React.MouseEvent) => {
    e.stopPropagation();
    setManifestationsExpanded(!manifestationsExpanded);
  };

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(result.uri)}
        >
          <ListItemText
            primary={
              <Box>
                <Typography component="span" sx={{ fontWeight: 'bold' }}>
                  {result.expressiontitle || result.uri.split("#").pop() || result.uri}
                </Typography>
                {showWorkTitle && (
                  <Typography component="span" sx={{ fontStyle: 'italic', ml: 1 }}>
                    ({result.worktitle})
                  </Typography>
                )}
              </Box>
            }
            secondary={
              <Box>

                {result.worknames && (
                  <Typography variant="body2" color="text.secondary">
                    {capitalizeFirstLetter(result.worknames)}
                  </Typography>
                )}
                {result.expressionnames && (
                  <Typography variant="body2" color="text.secondary">
                    {capitalizeFirstLetter(result.expressionnames)}
                  </Typography>
                )}
                {result.language && (
                  <Typography variant="caption" color="text.secondary">
                    Language: {capitalizeFirstLetter(result.language)}
                  </Typography>
                )}
                {result.contenttype && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    Content type: {capitalizeFirstLetter(result.contenttype)}
                  </Typography>
                )}
                {result.worktype && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    Work type: {capitalizeFirstLetter(result.worktype)}
                  </Typography>
                )}
              </Box>
            }
          />
          <IconButton
            size="small"
            onClick={handleToggleManifestations}
            sx={{ ml: 1 }}
          >
            {manifestationsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </ListItemButton>
      </ListItem>
      <Collapse in={manifestationsExpanded} timeout="auto" unmountOnExit>
        <ManifestationList
          config={config}
          expressionUri={result.uri}
          selectedManifestationUri={selectedManifestationUri}
          onManifestationSelect={onManifestationSelect}
          selectedLanguage={selectedLanguage}
        />
      </Collapse>
    </>
  );
};

export default Expression;
