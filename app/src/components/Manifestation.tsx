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
import {
  capitalizeFirstLetter,
  parseCreators,
  formatTitleArea,
  formatPublicationPhysicalSeries,
  formatNotes,
  formatIdentifiers,
} from "../utils/textFormatters";
import { getCarrierTypeIcon, typeIconSmallSx } from "../utils/contentTypeIcons";

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
  const CarrierIcon = getCarrierTypeIcon(manifestation.carriertype, manifestation.mediatype);
  const titleArea = formatTitleArea(manifestation);
  const publicationLine = formatPublicationPhysicalSeries(manifestation);
  const notesLine = formatNotes(manifestation.notes);
  const identifiersLine = formatIdentifiers(manifestation.identifiers);

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
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <CarrierIcon sx={typeIconSmallSx} />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                  }}
                >
                  {titleArea}
                </Typography>
              </Box>

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
                        {creator.names.map((entry, nameIndex) => (
                          <React.Fragment key={nameIndex}>
                            {nameIndex > 0 && ' ; '}
                            {onEntitySearch ? (
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
                            ) : (
                              entry.name
                            )}
                          </React.Fragment>
                        ))}
                      </Box>
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Line 2: Publication area + Physical description + Series */}
              {publicationLine && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.5,
                    fontSize: '0.8125rem',
                  }}
                >
                  {publicationLine}
                </Typography>
              )}

              {/* Line 3: Notes (all on one line) */}
              {notesLine && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.4,
                  }}
                >
                  {notesLine}
                </Typography>
              )}

              {/* Line 4: Identifiers (all on one line) */}
              {identifiersLine && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.4,
                  }}
                >
                  {identifiersLine}
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
