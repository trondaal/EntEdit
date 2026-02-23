import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Collapse,
  IconButton,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import ExpressionList from "./ExpressionList";

interface ManifestationSearchResultProps {
  result: ManifestationSearchResultType;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  selectedLanguage: string;
  config: SparqlEndpointConfig;
}

const ManifestationSearchResult: React.FC<ManifestationSearchResultProps> = ({
  result,
  isSelected,
  onSelect,
  selectedLanguage,
  config,
}) => {
  const [expressionsExpanded, setExpressionsExpanded] = useState(false);

  const handleToggleExpressions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpressionsExpanded(!expressionsExpanded);
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Helper function to split pipe-separated values into array
  const splitValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*\|\s*/).map(v => v.trim()).filter(v => v.length > 0);
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

  // Collect all metadata chips
  const allChips: string[] = [];
  if (result.mediatype) {
    allChips.push(...splitValues(result.mediatype));
  }
  if (result.carriertype) {
    allChips.push(...splitValues(result.carriertype));
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
                {/* Line 1: Title area */}
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                    lineHeight: 1.5,
                    fontSize: '0.9375rem',
                  }}
                >
                  {formatTitleArea()}
                </Typography>

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
                {allChips.length > 0 && (
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
                  </Box>
                )}
              </Box>
            }
          />
          <IconButton
            size="small"
            onClick={handleToggleExpressions}
            sx={{ ml: 1 }}
          >
            {expressionsExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </ListItemButton>
      </ListItem>
      <Collapse in={expressionsExpanded} timeout="auto" unmountOnExit>
        <ExpressionList
          config={config}
          manifestationUri={result.uri}
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

export default ManifestationSearchResult;
