import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
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
            (manifestation.extent || manifestation.mediatype || manifestation.carriertype) ? (
              <Box sx={{ mt: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.4,
                    display: 'block',
                  }}
                >
                  {[
                    manifestation.extent,
                    manifestation.mediatype,
                    manifestation.carriertype,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </Typography>
              </Box>
            ) : null
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Manifestation;
