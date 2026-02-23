import React from "react";
import {
  List,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import Manifestation from "./Manifestation";
import { useManifestations } from "../hooks/useManifestationQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ManifestationListProps {
  config: SparqlEndpointConfig;
  expressionUri: string;
  selectedManifestationUri: string | null;
  onManifestationSelect: (uri: string) => void;
  selectedLanguage: string;
}

const ManifestationList: React.FC<ManifestationListProps> = ({
  config,
  expressionUri,
  selectedManifestationUri,
  onManifestationSelect,
  selectedLanguage,
}) => {
  const {
    data: manifestations,
    isLoading,
    error,
  } = useManifestations(config, expressionUri, selectedLanguage);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2, pl: 4 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, pl: 4 }}>
        <Typography variant="body2" color="error">
          Error loading manifestations: {(error as Error).message}
        </Typography>
      </Box>
    );
  }

  if (!manifestations || manifestations.length === 0) {
    return (
      <Box sx={{ p: 2, pl: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No manifestations found
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {manifestations.map((manifestation) => (
        <Manifestation
          key={manifestation.uri}
          manifestation={manifestation}
          isSelected={selectedManifestationUri === manifestation.uri}
          onSelect={onManifestationSelect}
          selectedLanguage={selectedLanguage}
        />
      ))}
    </List>
  );
};

export default ManifestationList;
