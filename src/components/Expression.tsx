import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip,
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

  // Determine the primary display title
  // Priority: expression_title > work_title > URI
  const primaryTitle = result.expression_title || result.work_title || result.uri.split("#").pop() || result.uri;

  // Show work_title in parentheses only if:
  // 1. work_title exists AND
  // 2. expression_title exists (so work_title is not already the primary title) AND
  // 3. they are different
  const showWorkTitle = result.work_title && result.expression_title && result.work_title !== result.expression_title;

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Helper function to parse and format relationship strings
  // Example input: "er del av verk: The border trilogy = http://viaf.org/viaf/175871715 ; er bearbeidet som spillefilm (verk): All the pretty horses = https://www.imdb.com/title/tt0149624"
  // Output: Array of { relationshipLabel, title }
  const parseRelationships = (relationshipString: string | undefined): Array<{ relationshipLabel: string; title: string }> => {
    if (!relationshipString) return [];

    // Split by semicolon to get individual relationships
    const relationships = relationshipString.split(';').map(rel => rel.trim());

    return relationships.map(rel => {
      // Split by colon to separate relationship label from title+URI
      const colonIndex = rel.indexOf(':');
      if (colonIndex === -1) return null;

      const relationshipLabel = rel.substring(0, colonIndex).trim();
      const titleAndUri = rel.substring(colonIndex + 1).trim();

      // Split by ' = ' to separate title from URI
      const parts = titleAndUri.split(' = ');
      const title = parts[0]?.trim() || titleAndUri;

      return { relationshipLabel, title };
    }).filter((rel): rel is { relationshipLabel: string; title: string } => rel !== null);
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
          sx={{
            alignItems: 'flex-end',
          }}
        >
          <ListItemText
            primary={
              <Box sx={{ mb: 0.5 }}>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    lineHeight: 1.4,
                  }}
                >
                  {primaryTitle}
                </Typography>
                {showWorkTitle && (
                  <Typography
                    component="span"
                    sx={{
                      fontStyle: 'italic',
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                      ml: 1,
                    }}
                  >
                    ({result.work_title})
                  </Typography>
                )}
              </Box>
            }
            secondary={
              <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>

                {/* Section 1: Creators */}
                {(result.work_creators || result.expression_creators) && (
                  <Box>
                    {result.work_creators && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5 }}
                      >
                        {capitalizeFirstLetter(result.work_creators)}
                      </Typography>
                    )}
                    {result.expression_creators && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5 }}
                      >
                        {capitalizeFirstLetter(result.expression_creators)}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Section 2: Metadata Tags - Use chip-style layout */}
                {(result.language || result.contenttype || result.worktype) && (
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    mt: 0.25,
                  }}>
                    {result.language && (
                      <Chip
                        label={capitalizeFirstLetter(result.language)}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderColor: 'divider',
                        }}
                      />
                    )}
                    {result.contenttype && (
                      <Chip
                        label={capitalizeFirstLetter(result.contenttype)}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderColor: 'divider',
                        }}
                      />
                    )}
                    {result.worktype && (
                      <Chip
                        label={capitalizeFirstLetter(result.worktype)}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderColor: 'divider',
                        }}
                      />
                    )}
                  </Box>
                )}

                {/* Section 3: Relationships */}
                {(result.work_to_work_relationships || result.expression_to_expression_relationships) && (
                  <Box sx={{ mt: 0.5 }}>
                    {result.work_to_work_relationships && (
                      <Box sx={{ mb: 0.5 }}>
                        {parseRelationships(result.work_to_work_relationships).map((rel, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.8125rem',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'baseline',
                              '&:not(:last-child)': { mb: 0.25 }
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.75rem',
                                mr: 0.5,
                              }}
                            >
                              →
                            </Box>
                            <Box component="span">
                              {capitalizeFirstLetter(rel.relationshipLabel)}: <em>{rel.title}</em>
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {result.expression_to_expression_relationships && (
                      <Box>
                        {parseRelationships(result.expression_to_expression_relationships).map((rel, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.8125rem',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'baseline',
                              '&:not(:last-child)': { mb: 0.25 }
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.75rem',
                                mr: 0.5,
                              }}
                            >
                              →
                            </Box>
                            <Box component="span">
                              {capitalizeFirstLetter(rel.relationshipLabel)}: <em>{rel.title}</em>
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
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
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
    </>
  );
};

export default Expression;
