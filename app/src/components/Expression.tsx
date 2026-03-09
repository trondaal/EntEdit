import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  Collapse,
  Chip,
  Link,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import type { ExpressionSearchResult } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import ManifestationList from "./ManifestationList";

interface ExpressionProps {
  result: ExpressionSearchResult;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedManifestationUri: string | null;
  onManifestationSelect: (uri: string) => void;
  selectedLanguage: string;
  onEntitySearch: (name: string) => void;
}

const Expression: React.FC<ExpressionProps> = ({
  result,
  isSelected,
  onSelect,
  config,
  selectedManifestationUri,
  onManifestationSelect,
  selectedLanguage,
  onEntitySearch,
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

  // Helper function to split semicolon-separated values into array
  const splitValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*;\s*/).map(v => v.trim()).filter(v => v.length > 0);
  };

  // Helper function to parse creator strings
  // Example input: "rolelabel: name = uri & name = uri ; rolelabel: name = uri"
  // Output: Array of { role, names: Array<{ name, uri? }> }
  const parseCreators = (creatorString: string | undefined) => {
    if (!creatorString) return [] as Array<{ role: string; names: Array<{ name: string; uri?: string }> }>;

    // Split by semicolon to get individual role groups
    const roleGroups = creatorString.split(';').map(group => group.trim());

    return roleGroups.flatMap(group => {
      // Split by colon to separate role from names
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return [];

      const role = group.substring(0, colonIndex).trim();
      const namesString = group.substring(colonIndex + 1).trim();

      // Split by ' & ' to get individual "name = uri" entries
      const names = namesString.split('&').map(entry => {
        const parts = entry.trim().split(' = ');
        return {
          name: parts[0]?.trim() || '',
          uri: parts.length > 1 ? parts[1]?.trim() : undefined,
        };
      }).filter(entry => entry.name.length > 0);

      return [{ role, names }];
    });
  };

  // Helper function to parse and format relationship strings
  // Example input: "har del av verk: All the pretty horses = http://viaf.org/viaf/214001528 & Cities of the plain = http://viaf.org/viaf/3417153653286155900001 ; er bearbeidet som spillefilm (verk): All the pretty horses = https://www.imdb.com/title/tt0149624"
  // Output: Array of { relationshipLabel, title, uri? }
  const parseRelationships = (relationshipString: string | undefined): Array<{ relationshipLabel: string; title: string; uri?: string }> => {
    if (!relationshipString) return [];

    const result: Array<{ relationshipLabel: string; title: string; uri?: string }> = [];

    // Split by semicolon to get individual relationship groups
    const relationshipGroups = relationshipString.split(';').map(group => group.trim());

    relationshipGroups.forEach(group => {
      // Split by colon to separate relationship label from title+URI pairs
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return;

      const relationshipLabel = group.substring(0, colonIndex).trim();
      const titleAndUriPairs = group.substring(colonIndex + 1).trim();

      // Split by ' & ' to get individual title=URI pairs
      const pairs = titleAndUriPairs.split('&').map(pair => pair.trim());

      pairs.forEach(pair => {
        // Split by ' = ' to separate title from URI
        const parts = pair.split(' = ');
        const title = parts[0]?.trim();
        const uri = parts[1]?.trim();

        if (title) {
          result.push({ relationshipLabel, title, uri });
        }
      });
    });

    return result;
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
                      <Box>
                        {parseCreators(result.work_creators).map((creator, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.5 }}
                          >
                            <Box
                              component="span"
                              className="creator-role"
                              sx={{
                                fontWeight: 500,
                                color: 'text.primary',
                              }}
                            >
                              {capitalizeFirstLetter(creator.role)}:
                            </Box>{' '}
                            <Box
                              component="span"
                              className="creator-names"
                            >
                              {creator.names.map((entry, nameIndex) => (
                                <React.Fragment key={nameIndex}>
                                  {nameIndex > 0 && ' ; '}
                                  <Link
                                    component="button"
                                    variant="body2"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onEntitySearch(entry.name);
                                    }}
                                    sx={{
                                      textDecoration: 'none',
                                      '&:hover': { textDecoration: 'underline' },
                                      cursor: 'pointer',
                                      color: 'inherit',
                                      verticalAlign: 'baseline',
                                      fontSize: 'inherit',
                                      lineHeight: 'inherit',
                                    }}
                                  >
                                    {entry.name}
                                  </Link>
                                </React.Fragment>
                              ))}
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {result.expression_creators && (
                      <Box>
                        {parseCreators(result.expression_creators).map((creator, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.5 }}
                          >
                            <Box
                              component="span"
                              className="creator-role"
                              sx={{
                                fontWeight: 500,
                                color: 'text.primary',
                              }}
                            >
                              {capitalizeFirstLetter(creator.role)}:
                            </Box>{' '}
                            <Box
                              component="span"
                              className="creator-names"
                            >
                              {creator.names.map((entry, nameIndex) => (
                                <React.Fragment key={nameIndex}>
                                  {nameIndex > 0 && ' ; '}
                                  <Link
                                    component="button"
                                    variant="body2"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onEntitySearch(entry.name);
                                    }}
                                    sx={{
                                      textDecoration: 'none',
                                      '&:hover': { textDecoration: 'underline' },
                                      cursor: 'pointer',
                                      color: 'inherit',
                                      verticalAlign: 'baseline',
                                      fontSize: 'inherit',
                                      lineHeight: 'inherit',
                                    }}
                                  >
                                    {entry.name}
                                  </Link>
                                </React.Fragment>
                              ))}
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Section 2: Relationships */}
                {(result.work_to_work_relationships || result.expression_to_expression_relationships) && (
                  <Box>
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
                              {capitalizeFirstLetter(rel.relationshipLabel)}:{' '}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(rel.title);
                                }}
                                sx={{
                                  textDecoration: 'none',
                                  fontStyle: 'italic',
                                  '&:hover': { textDecoration: 'underline' },
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                  verticalAlign: 'baseline',
                                }}
                              >
                                {rel.title}
                              </Link>
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
                              {capitalizeFirstLetter(rel.relationshipLabel)}:{' '}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(rel.title);
                                }}
                                sx={{
                                  textDecoration: 'none',
                                  fontStyle: 'italic',
                                  '&:hover': { textDecoration: 'underline' },
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                  verticalAlign: 'baseline',
                                }}
                              >
                                {rel.title}
                              </Link>
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Section 3: Metadata Tags - Use chip-style layout */}
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.25,
                }}>
                  {splitValues(result.language).map((lang, index) => (
                    <Chip
                      key={`lang-${index}`}
                      label={capitalizeFirstLetter(lang)}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                  {splitValues(result.contenttype).map((ct, index) => (
                    <Chip
                      key={`ct-${index}`}
                      label={capitalizeFirstLetter(ct)}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                  {splitValues(result.worktype).map((wt, index) => (
                    <Chip
                      key={`wt-${index}`}
                      label={capitalizeFirstLetter(wt)}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                  <Chip
                    label="Publications"
                    size="small"
                    variant="outlined"
                    onClick={handleToggleManifestations}
                    icon={manifestationsExpanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{
                      ml: 2,
                      cursor: 'pointer',
                      height: 20,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      borderColor: 'divider',
                      '& .MuiChip-label': { overflow: 'visible' },
                      '& .MuiChip-icon': { fontSize: '1rem' },
                    }}
                  />
                </Box>

              </Box>
            }
          />
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
