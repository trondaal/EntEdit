import React from "react";
import {
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import ManifestationSearchResult from "./ManifestationSearchResult";
import type { EntitySearchHandler } from "../utils/searchLink";
import { useManifestations } from "../hooks/useManifestationQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { useResultDisplay } from "../hooks/useResultDisplay";
import { ResultLevelContext, useResultLevel } from "../hooks/useResultLevel";
import { sectionStyle } from "../utils/resultColors";

interface ManifestationListProps {
  config: SparqlEndpointConfig;
  expressionUri: string;
  selectedLanguage: string;
  onEntitySearch: EntitySearchHandler;
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

  // The list is one level below the card it is opened from; its entries and what they open follow
  const { colors } = useResultDisplay();
  const listLevel = useResultLevel() + 1;
  const sectionSx = sectionStyle(colors, listLevel);

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

  // Each manifestation is presented as in the publication search, with its
  // collection merged and its contents listed; only the expression the list is
  // under is not repeated (`parentExpressionUri`)
  return (
    <ResultLevelContext.Provider value={listLevel}>
      <Box sx={{ ...sectionSx, pl: 4, pr: 1, pt: 1 }}>
        {manifestations.map((manifestation) => (
          <ManifestationSearchResult
            key={manifestation.uri}
            result={manifestation}
            selectedLanguage={selectedLanguage}
            config={config}
            parentExpressionUri={expressionUri}
            onEntitySearch={onEntitySearch}
          />
        ))}
      </Box>
    </ResultLevelContext.Provider>
  );
};

export default ManifestationList;
