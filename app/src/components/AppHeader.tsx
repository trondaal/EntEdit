import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Dialog,
  IconButton,
  Box,
} from "@mui/material";
import { Settings, Help } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import LanguageSelector from "./LanguageSelector";
import EndpointConfig from "./EndpointConfig";

interface AppHeaderProps {
  config: SparqlEndpointConfig;
  onConfigChange: (config: SparqlEndpointConfig) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  onResetConfiguration?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  config,
  onConfigChange,
  selectedLanguage,
  onLanguageChange,
  onResetConfiguration,
}) => {
  const { t } = useTranslation();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const getEndpointDisplayName = (url: string): string => {
    try {
      const urlObj = new URL(url, window.location.origin);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);

      // Extract meaningful parts from URL
      if (pathParts.includes("repositories")) {
        const repoIndex = pathParts.indexOf("repositories");
        const repoName = pathParts[repoIndex + 1];
        return repoName || "GraphDB";
      }

      // For Fuseki or other endpoints
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }

      return urlObj.hostname === "localhost" ? "Local" : urlObj.hostname;
    } catch {
      // Fallback for relative URLs
      const parts = url.split("/").filter(Boolean);
      return parts[parts.length - 1] || "Database";
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
        }}
      >
        <Toolbar
          sx={{
            minHeight: 64,
            height: 64,
            maxWidth: 1536, // Match Container maxWidth="xl"
            width: "100%",
            mx: "auto",
            px: 2,
          }}
        >
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {t("appTitle")}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Endpoint Configuration Chip */}
            <Chip
              label={getEndpointDisplayName(config.url)}
              onClick={() => setConfigDialogOpen(true)}
              icon={<Settings />}
              variant="outlined"
              color="primary"
              sx={{
                minWidth: 140,
                maxWidth: 180,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                color: "white",
                "& .MuiChip-icon": { color: "white" },
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                },
              }}
            />

            {/* Language Selector - styled for header */}
            <Box
              sx={{
                "& .MuiInputLabel-root": {
                  color: "rgba(255, 255, 255, 0.7)",
                  "&.Mui-focused": { color: "white" },
                },
                "& .MuiSelect-root": {
                  color: "white",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.3)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255, 255, 255, 0.5)",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "white",
                  },
                },
                "& .MuiSvgIcon-root": {
                  color: "white",
                },
              }}
            >
              <LanguageSelector
                config={config}
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
              />
            </Box>

            {/* Help Button */}
            <IconButton
              color="inherit"
              aria-label={t("labels.help")}
              onClick={() => {
                window.open("./docs/README.md", "_blank", "noopener,noreferrer");
              }}
            >
              <Help />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Configuration Modal Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <EndpointConfig
          config={config}
          onConfigChange={(newConfig) => {
            onConfigChange(newConfig);
            setConfigDialogOpen(false);
          }}
          selectedLanguage={selectedLanguage}
          onLanguageChange={onLanguageChange}
          isModal={true}
          onResetConfiguration={() => {
            setConfigDialogOpen(false);
            onResetConfiguration?.();
          }}
        />
      </Dialog>
    </>
  );
};

export default AppHeader;
