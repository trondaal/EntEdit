import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Link,
} from "@mui/material";
import type { Manifestation as ManifestationType } from "../hooks/useManifestationQueries";

interface ManifestationProps {
  manifestation: ManifestationType;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  selectedLanguage: string;
  onEntitySearch?: (name: string) => void;
}

const Manifestation: React.FC<ManifestationProps> = ({
  manifestation,
  isSelected,
  onSelect,
  onEntitySearch,
}) => {
  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Helper function to parse creator strings
  const parseCreators = (creatorString: string | undefined): Array<{ role: string; names: string[] }> => {
    if (!creatorString) return [];

    const roleGroups = creatorString.split(';').map(group => group.trim());

    return roleGroups.map(group => {
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return null;

      const role = group.substring(0, colonIndex).trim();
      const namesString = group.substring(colonIndex + 1).trim();
      const names = namesString.split('&').map(name => name.trim()).filter(name => name.length > 0);

      return { role, names };
    }).filter((group): group is { role: string; names: string[] } => group !== null);
  };

  // Helper function to split pipe-separated values into array
  const splitValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*\|\s*/).map(v => v.trim()).filter(v => v.length > 0);
  };

  // Line 1: Title area (Title proper : Other title information / Statement of responsibility)
  const formatTitleArea = () => {
    if (!manifestation.title) return manifestation.uri;

    let formatted = manifestation.title;
    if (manifestation.other) {
      formatted += ` : ${manifestation.other}`;
    }
    if (manifestation.responsibilityStatement) {
      formatted += ` / ${manifestation.responsibilityStatement}`;
    }
    return formatted;
  };

  // Line 2: Publication area + Physical description + Series
  // (Edition . – Place : Publisher , Date . – Extent ; Dimensions . – (Series ; Numbering))
  const formatPublicationPhysicalSeries = () => {
    const parts: string[] = [];

    // Publication area
    if (manifestation.edition) {
      parts.push(manifestation.edition);
    }

    const pubParts: string[] = [];
    if (manifestation.place) {
      pubParts.push(manifestation.place);
    }
    if (manifestation.publisher) {
      pubParts.push(manifestation.place ? ` : ${manifestation.publisher}` : manifestation.publisher);
    }
    if (manifestation.date) {
      pubParts.push(pubParts.length > 0 ? ` , ${manifestation.date}` : manifestation.date);
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
    if (manifestation.extent) {
      physParts.push(manifestation.extent);
    }
    if (manifestation.dimensions) {
      physParts.push(manifestation.extent ? ` ; ${manifestation.dimensions}` : manifestation.dimensions);
    }

    if (physParts.length > 0) {
      if (parts.length > 0) {
        parts.push(` . – ${physParts.join('')}`);
      } else {
        parts.push(physParts.join(''));
      }
    }

    // Series
    if (manifestation.series || manifestation.seriesNumbering) {
      let seriesFormatted = '';
      if (manifestation.series) {
        seriesFormatted = manifestation.series;
      }
      if (manifestation.seriesNumbering) {
        seriesFormatted += seriesFormatted ? ` ; ${manifestation.seriesNumbering}` : manifestation.seriesNumbering;
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
    if (!manifestation.notes) return null;
    return splitValues(manifestation.notes).join(' ; ');
  };

  // Line 4: Identifiers (all on one line, separated by ' ; ')
  const formatIdentifiers = () => {
    if (!manifestation.identifiers) return null;
    return splitValues(manifestation.identifiers).join(' ; ');
  };

  return (
    <ListItem
      disablePadding
      sx={{
        pl: 4,
        bgcolor: (theme) => theme.palette.mode === 'light'
          ? 'grey.50'
          : 'grey.900',
      }}
    >
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(manifestation.uri)}
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* Line 1: Title area */}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {formatTitleArea()}
              </Typography>

              {/* Creators */}
              {manifestation.manifestation_creators && (
                <Box>
                  {parseCreators(manifestation.manifestation_creators).map((creator, index) => (
                    <Typography
                      key={index}
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                    >
                      <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {capitalizeFirstLetter(creator.role)}:
                      </Box>
                      {' '}
                      <Box component="span">
                        {creator.names.map((name, nameIndex) => (
                          <React.Fragment key={nameIndex}>
                            {nameIndex > 0 && ' ; '}
                            {onEntitySearch ? (
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(name);
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
                                {name}
                              </Link>
                            ) : (
                              name
                            )}
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

              {/* Media type and Carrier type chips */}
              {(manifestation.mediatype || manifestation.carriertype) && (
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.5,
                }}>
                  {manifestation.carriertype && (
                    <Chip
                      label={capitalizeFirstLetter(manifestation.carriertype)}
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
                  {manifestation.mediatype && (
                    <Chip
                      label={capitalizeFirstLetter(manifestation.mediatype)}
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
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Manifestation;
