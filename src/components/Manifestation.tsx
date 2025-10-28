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
    <ListItem disablePadding sx={{ pl: 4 }}>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(manifestation.uri)}
      >
        <ListItemText
          primary={
            <Box>
              <Typography variant="body2">
                {formatTitle()}
              </Typography>
              {formatPublicationInfo() && (
                <Typography variant="body2" color="text.secondary">
                  {formatPublicationInfo()}
                </Typography>
              )}
            </Box>
          }
          secondary={
            <Box>
              {manifestation.extent && (
                <Typography variant="caption" color="text.secondary">
                  {manifestation.extent}
                </Typography>
              )}
              {manifestation.mediatype && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: manifestation.extent ? 2 : 0 }}>
                  {manifestation.mediatype}
                </Typography>
              )}
              {manifestation.carriertype && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: (manifestation.extent || manifestation.mediatype) ? 2 : 0 }}>
                  {manifestation.carriertype}
                </Typography>
              )}
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Manifestation;
