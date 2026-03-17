import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Collapse,
  Link,
  IconButton,
  Tooltip,
} from "@mui/material";
import { ExpandMore, ExpandLess, AccountTree } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { getGraphVisualizationUrl } from "../utils/graphUtils";
import { useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import ExpressionList from "./ExpressionList";

interface ManifestationSearchResultProps {
  result: ManifestationSearchResultType;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  selectedLanguage: string;
  config: SparqlEndpointConfig;
  onEntitySearch: (name: string) => void;
}

const ManifestationSearchResult: React.FC<ManifestationSearchResultProps> = ({
  result,
  isSelected,
  onSelect,
  selectedLanguage,
  config,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const [expressionsExpanded, setExpressionsExpanded] = useState(false);
  const graphUrl = getGraphVisualizationUrl(config.url, result.uri);

  // Auto-fetch expression data when there is exactly one expression
  const isSingleExpression = result.expression_count === 1;
  const autoFetchUri = isSingleExpression ? result.uri : null;
  const { data: expressions } = useExpressionsByManifestation(config, autoFetchUri, selectedLanguage);
  const singleExpression = expressions?.[0];

  const handleToggleExpressions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpressionsExpanded(!expressionsExpanded);
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Helper function to parse creator strings
  // Example input: "rolelabel: name = uri & name = uri ; rolelabel: name = uri"
  // Output: Array of { role, names: Array<{ name, uri? }> }
  const parseCreators = (creatorString: string | undefined) => {
    if (!creatorString) return [] as Array<{ role: string; names: Array<{ name: string; uri?: string }> }>;

    const roleGroups = creatorString.split(';').map(group => group.trim());

    return roleGroups.flatMap(group => {
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return [];

      const role = group.substring(0, colonIndex).trim();
      const namesString = group.substring(colonIndex + 1).trim();
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

  // Helper function to split pipe-separated values into array (manifestation data)
  const splitValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*\|\s*/).map(v => v.trim()).filter(v => v.length > 0);
  };

  // Helper function to split semicolon-separated values into array (expression data)
  const splitSemicolonValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*;\s*/).map(v => v.trim()).filter(v => v.length > 0);
  };

  // Line 1: Title area (Title proper : Other title information / Statement of responsibility)
  const formatTitleArea = () => {
    if (!result.title) return result.uri;

    let formatted = result.title;
    if (result.other) {
      formatted += ` : ${result.other}`;
    }
    if (result.responsibilityStatement) {
      formatted += ` / ${result.responsibilityStatement}`;
    }
    return formatted;
  };

  // Line 2: Publication area + Physical description + Series
  // (Edition . – Place : Publisher , Date . – Extent ; Dimensions . – (Series ; Numbering))
  const formatPublicationPhysicalSeries = () => {
    const parts: string[] = [];

    // Publication area
    if (result.edition) {
      parts.push(result.edition);
    }

    const pubParts: string[] = [];
    if (result.place) {
      pubParts.push(result.place);
    }
    if (result.publisher) {
      pubParts.push(result.place ? ` : ${result.publisher}` : result.publisher);
    }
    if (result.date) {
      pubParts.push(pubParts.length > 0 ? ` , ${result.date}` : result.date);
    }

    if (pubParts.length > 0) {
      if (parts.length > 0) {
        parts.push(` . – ${pubParts.join('')}`);
      } else {
        parts.push(pubParts.join(''));
      }
    }

    // Physical description
    const physParts: string[] = [];
    if (result.extent) {
      physParts.push(result.extent);
    }
    if (result.dimensions) {
      physParts.push(result.extent ? ` ; ${result.dimensions}` : result.dimensions);
    }

    if (physParts.length > 0) {
      if (parts.length > 0) {
        parts.push(` . – ${physParts.join('')}`);
      } else {
        parts.push(physParts.join(''));
      }
    }

    // Series
    if (result.series || result.seriesNumbering) {
      let seriesFormatted = '';
      if (result.series) {
        seriesFormatted = result.series;
      }
      if (result.seriesNumbering) {
        seriesFormatted += seriesFormatted ? ` ; ${result.seriesNumbering}` : result.seriesNumbering;
      }
      if (seriesFormatted) {
        if (parts.length > 0) {
          parts.push(` . – (${seriesFormatted})`);
        } else {
          parts.push(`(${seriesFormatted})`);
        }
      }
    }

    return parts.length > 0 ? parts.join('') : null;
  };

  // Line 3: Notes (all on one line, separated by ' ; ')
  const formatNotes = () => {
    if (!result.notes) return null;
    return splitValues(result.notes).join(' ; ');
  };

  // Line 4: Identifiers (all on one line, separated by ' ; ')
  const formatIdentifiers = () => {
    if (!result.identifiers) return null;
    return splitValues(result.identifiers).join(' ; ');
  };

  // Collect all metadata chips (manifestation-level)
  const allChips: string[] = [];
  if (result.mediatype) {
    allChips.push(...splitValues(result.mediatype));
  }
  if (result.carriertype) {
    allChips.push(...splitValues(result.carriertype));
  }
  // Add expression-level chips when single expression is loaded
  if (singleExpression) {
    if (singleExpression.language) {
      allChips.push(...splitSemicolonValues(singleExpression.language));
    }
    if (singleExpression.contenttype) {
      allChips.push(...splitSemicolonValues(singleExpression.contenttype));
    }
    if (singleExpression.worktype) {
      allChips.push(...splitSemicolonValues(singleExpression.worktype));
    }
  }

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(result.uri)}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {/* Line 1: Title area with visualization button */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Typography
                    variant="body1"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 500,
                      lineHeight: 1.5,
                      fontSize: '0.9375rem',
                    }}
                  >
                    {formatTitleArea()}
                  </Typography>
                  {graphUrl && (
                    <Tooltip title={t("common:buttons.graph")}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(graphUrl, "_blank", "noopener,noreferrer");
                        }}
                        sx={{
                          ml: 1,
                          mt: -0.5,
                          p: 0.5,
                          color: 'text.disabled',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        <AccountTree sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Creators (manifestation-level + expression-level when single expression) */}
                {(result.manifestation_creators || (singleExpression && (singleExpression.work_creators || singleExpression.expression_creators))) && (
                  <Box>
                    {result.manifestation_creators && parseCreators(result.manifestation_creators).map((creator, index) => (
                      <Typography
                        key={`m-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
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
                    {singleExpression?.work_creators && parseCreators(singleExpression.work_creators).map((creator, index) => (
                      <Typography
                        key={`wc-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
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
                    {singleExpression?.expression_creators && parseCreators(singleExpression.expression_creators).map((creator, index) => (
                      <Typography
                        key={`ec-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
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

                {/* Line 2: Publication area + Physical description + Series */}
                {formatPublicationPhysicalSeries() && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.5,
                      fontSize: '0.8125rem',
                    }}
                  >
                    {formatPublicationPhysicalSeries()}
                  </Typography>
                )}

                {/* Line 3: Notes (all on one line) */}
                {formatNotes() && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.4,
                    }}
                  >
                    {formatNotes()}
                  </Typography>
                )}

                {/* Line 4: Identifiers (all on one line) */}
                {formatIdentifiers() && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.4,
                    }}
                  >
                    {formatIdentifiers()}
                  </Typography>
                )}

                {/* Metadata chips */}
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.5,
                }}>
                  {allChips.map((chip, index) => (
                    <Chip
                      key={`chip-${index}`}
                      label={capitalizeFirstLetter(chip)}
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
                  {!isSingleExpression && (
                    <Chip
                      label={result.expression_count != null ? `Contents (${result.expression_count})` : "Contents"}
                      size="small"
                      variant="outlined"
                      onClick={handleToggleExpressions}
                      icon={expressionsExpanded ? <ExpandLess /> : <ExpandMore />}
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
                  )}
                </Box>
              </Box>
            }
          />
        </ListItemButton>
      </ListItem>
      {!isSingleExpression && (
        <Collapse in={expressionsExpanded} timeout="auto" unmountOnExit>
          <ExpressionList
            config={config}
            manifestationUri={result.uri}
            selectedLanguage={selectedLanguage}
            onEntitySearch={onEntitySearch}
          />
        </Collapse>
      )}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
    </>
  );
};

export default ManifestationSearchResult;
