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

  // Determine if work_title should be shown (different from expression_title)
  const showWorkTitle = result.work_title && result.work_title !== result.expression_title;

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
                  {result.expression_title || result.uri.split("#").pop() || result.uri}
                </Typography>
                {showWorkTitle && (
                  <Typography component="span" sx={{ fontStyle: 'italic', ml: 1 }}>
                    ({result.work_title})
                  </Typography>
                )}
              </Box>
            }
            secondary={
              <Box>

                {result.work_creators && (
                  <Typography variant="body2" color="text.secondary">
                    {capitalizeFirstLetter(result.work_creators)}
                  </Typography>
                )}
                {result.expression_creators && (
                  <Typography variant="body2" color="text.secondary">
                    {capitalizeFirstLetter(result.expression_creators)}
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
