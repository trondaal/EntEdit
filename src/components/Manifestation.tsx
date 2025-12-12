import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
} from "@mui/material";
import type { Manifestation as ManifestationType } from "../hooks/useManifestationQueries";

interface ManifestationProps {
  manifestation: ManifestationType;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  selectedLanguage: string;
}

const Manifestation: React.FC<ManifestationProps> = ({
  manifestation,
  isSelected,
  onSelect,
  selectedLanguage: _selectedLanguage,
}) => {
  // Debug: Log manifestation data to console
  console.log('Manifestation data:', {
    uri: manifestation.uri,
    mediatype: manifestation.mediatype,
    carriertype: manifestation.carriertype,
    extent: manifestation.extent,
    fullObject: manifestation
  });

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
  // Format the title with ISBD separators
  const formatTitle = () => {
    if (manifestation.title) {
      let formattedTitle = manifestation.title;

      // Add 'other' field with ISBD separator " : " if present
      if (manifestation.other) {
        formattedTitle += ` : ${manifestation.other}`;
      }

      // Add responsibility statement with ISBD separator " / " if present
      if (manifestation.responsibilityStatement) {
        formattedTitle += ` / ${manifestation.responsibilityStatement}`;
      }

      return formattedTitle;
    }
    return manifestation.uri;
  };

  // Format publication information with ISBD separators
  const formatPublicationInfo = () => {
    const parts: string[] = [];

    // Add place if present
    if (manifestation.place) {
      parts.push(manifestation.place);
    }

    // Add publisher with ISBD separator " : " if present
    if (manifestation.publisher) {
      if (parts.length > 0) {
        parts.push(` : ${manifestation.publisher}`);
      } else {
        parts.push(manifestation.publisher);
      }
    }

    // Add date with ISBD separator " , " if present
    if (manifestation.date) {
      if (parts.length > 0) {
        parts.push(` , ${manifestation.date}`);
      } else {
        parts.push(manifestation.date);
      }
    }

    return parts.length > 0 ? parts.join('') : null;
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
            <Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  lineHeight: 1.5,
                  mb: 0.25,
                }}
              >
                {formatTitle()}
              </Typography>
              {formatPublicationInfo() && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.5,
                    fontSize: '0.8125rem',
                  }}
                >
                  {formatPublicationInfo()}
                </Typography>
              )}
            </Box>
          }
          secondary={
            <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
              {/* Extent as text */}
              {manifestation.extent && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.4,
                    display: 'block',
                  }}
                >
                  {manifestation.extent}
                </Typography>
              )}

              {/* Media type and Carrier type as visual tags/chips */}
              {(manifestation.mediatype || manifestation.carriertype) && (
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                }}>
                  {splitValues(manifestation.carriertype).map((ct, index) => (
                    <Chip
                      key={`carrier-${index}`}
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
                  {splitValues(manifestation.mediatype).map((mt, index) => (
                    <Chip
                      key={`media-${index}`}
                      label={capitalizeFirstLetter(mt)}
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
      </ListItemButton>
    </ListItem>
  );
};

export default Manifestation;
