import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
  Box,
  Tooltip,
} from "@mui/material";
import { Settings, Help, Download, Refresh } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import type { SparqlEndpointConfig } from "../types/sparql";
import LanguageSelector from "./LanguageSelector";
import EndpointConfig from "./EndpointConfig";
import ExportDialog from "./ExportDialog";
import LoggingControls from "./LoggingControls";

interface AppHeaderProps {
  config: SparqlEndpointConfig;
  onConfigChange: (config: SparqlEndpointConfig, warnAutoUri: boolean, warnAutoLabel: boolean) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  onResetConfiguration?: () => void;
  showLogging?: boolean;
  warnAutoUri: boolean;
  warnAutoLabel: boolean;
  isDirty?: boolean;
  onRefresh?: (saveFirst: boolean) => Promise<void>;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  config,
  onConfigChange,
  selectedLanguage,
  onLanguageChange,
  onResetConfiguration,
  showLogging = true,
  warnAutoUri,
  warnAutoLabel,
  isDirty = false,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = async (saveFirst: boolean) => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh(saveFirst);
      enqueueSnackbar(t("messages.dataRefreshed"), {
        variant: "success",
        autoHideDuration: 3000,
      });
      setRefreshDialogOpen(false);
    } catch (error) {
      enqueueSnackbar(
        t("messages.refreshFailed", { message: (error as Error).message }),
        { variant: "error" },
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshClick = async () => {
    if (isDirty) {
      setRefreshDialogOpen(true);
      return;
    }
    await doRefresh(false);
  };

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
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          zIndex: 1200,
          borderRadius: 1,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 1px 3px rgba(45, 30, 15, 0.12), 0 1px 2px rgba(45, 30, 15, 0.08)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: 64,
            height: 64,
            px: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1 }}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
            <Typography variant="h6" component="div">
              {t("appTitle")}
            </Typography>
          </Box>

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
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.95)",
                borderColor: "rgba(255, 255, 255, 0.20)",
                "& .MuiChip-icon": { color: "rgba(255, 255, 255, 0.80)" },
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.22)",
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
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
              />
            </Box>

            {/* Interaction Logging Controls */}
            {showLogging && (
              <LoggingControls
                endpointUrl={config.url}
                language={selectedLanguage}
              />
            )}

            {/* Refresh Button — invalidates entity caches to pick up changes
                made by other users sharing the same database */}
            {onRefresh && (
              <Tooltip title={t("buttons.refresh")}>
                <span>
                  <IconButton
                    color="inherit"
                    aria-label={t("buttons.refresh")}
                    onClick={handleRefreshClick}
                    disabled={refreshing}
                  >
                    <Refresh />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Export Button */}
            <Tooltip title={t("buttons.export")}>
              <IconButton
                color="inherit"
                aria-label={t("buttons.export")}
                onClick={() => setExportDialogOpen(true)}
              >
                <Download />
              </IconButton>
            </Tooltip>

            {/* Help Button */}
            <IconButton
              color="inherit"
              aria-label={t("labels.help")}
              onClick={() => {
                const lang = ["no"].includes(selectedLanguage) ? selectedLanguage : "en";
                window.open(`./docs/${lang}/index.html`, "_blank", "noopener,noreferrer");
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
          onConfigChange={(newConfig, newWarnAutoUri, newWarnAutoLabel) => {
            onConfigChange(newConfig, newWarnAutoUri, newWarnAutoLabel);
            setConfigDialogOpen(false);
          }}
          selectedLanguage={selectedLanguage}
          onLanguageChange={onLanguageChange}
          isModal={true}
          onResetConfiguration={() => {
            setConfigDialogOpen(false);
            onResetConfiguration?.();
          }}
          warnAutoUri={warnAutoUri}
          warnAutoLabel={warnAutoLabel}
        />
      </Dialog>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        config={config}
        selectedLanguage={selectedLanguage}
      />

      {/* Refresh confirmation dialog — only shown when there are unsaved edits */}
      <Dialog
        open={refreshDialogOpen}
        onClose={() => !refreshing && setRefreshDialogOpen(false)}
        aria-labelledby="refresh-dialog-title"
      >
        <DialogTitle id="refresh-dialog-title">
          {t("dialogs.refresh.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("dialogs.refresh.message")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRefreshDialogOpen(false)}
            disabled={refreshing}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={() => doRefresh(false)}
            color="warning"
            disabled={refreshing}
          >
            {t("dialogs.refresh.discardAndRefresh")}
          </Button>
          <Button
            onClick={() => doRefresh(true)}
            variant="contained"
            disabled={refreshing}
          >
            {t("dialogs.refresh.saveAndRefresh")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AppHeader;
