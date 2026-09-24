import React from "react";
import {
  List,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import Manifestation from "./Manifestation";
import { useManifestations } from "../hooks/useManifestationQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ManifestationListProps {
  config: SparqlEndpointConfig;
  expressionUri: string;
  selectedLanguage: string;
  onEntitySearch?: (name: string) => void;
}

const ManifestationList: React.FC<ManifestationListProps> = ({
  config,
  expressionUri,
  selectedLanguage,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const {
    data: manifestations,
    isLoading,
    error,
  } = useManifestations(config, expressionUri, selectedLanguage);

  const sectionSx = {
    bgcolor: "rgba(139, 92, 42, 0.12)",
    borderTop: 1,
    borderColor: "divider",
  } as const;

  if (isLoading) {
    return (
      <Box sx={{ ...sectionSx, display: "flex", justifyContent: "center", p: 2, pl: 4 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ ...sectionSx, p: 2, pl: 4 }}>
        <Typography variant="body2" color="error">
          {t("search.errorLoadingManifestations", { message: (error as Error).message })}
        </Typography>
      </Box>
    );
  }

  if (!manifestations || manifestations.length === 0) {
    return (
      <Box sx={{ ...sectionSx, p: 2, pl: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t("search.noManifestationsFound")}
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding sx={sectionSx}>
      {manifestations.map((manifestation) => (
        <Manifestation
          key={manifestation.uri}
          manifestation={manifestation}
          selectedLanguage={selectedLanguage}
          onEntitySearch={onEntitySearch}
        />
      ))}
    </List>
  );
};

export default ManifestationList;
