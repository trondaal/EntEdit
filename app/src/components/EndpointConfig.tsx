import React, { useState } from "react";
import {
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Collapse,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  Dialog,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Settings,
  CheckCircle,
  Error as ErrorIcon,
  Lock,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import CatalogingStyleSettings from "./CatalogingStyleSettings";
import type { CatalogingPreferences } from "../utils/catalogingStyle";
import type { SparqlEndpointConfig } from "../types/sparql";
import LanguageSelector from "./LanguageSelector";
import { DEFAULT_DATA_GRAPH, dataGraphOf, isGraphSettingInvalid } from "../utils/dataGraph";
import {
  sameConnection,
  testEndpointConnection,
  type ConnectionTestResult,
} from "../utils/connectionTest";

interface EndpointConfigProps {
  config: SparqlEndpointConfig;
  onConfigChange: (
    config: SparqlEndpointConfig,
    preferences: CatalogingPreferences,
  ) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  isModal?: boolean;
  onResetConfiguration?: () => void;
  preferences: CatalogingPreferences;
  /** Closes the dialog without saving; only meaningful in the modal form. */
  onCancel?: () => void;
}

const EndpointConfig: React.FC<EndpointConfigProps> = ({
  config,
  onConfigChange,
  selectedLanguage,
  onLanguageChange,
  isModal = false,
  onResetConfiguration,
  preferences,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // A test result describes the settings it was run against, so editing them
  // makes it stale.
  const editConnection = (changes: Partial<SparqlEndpointConfig>) => {
    setLocalConfig((current) => ({ ...current, ...changes }));
    setTestResult(null);
  };

  const connectionChanged = !sameConnection(localConfig, config);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestResult(await testEndpointConnection(localConfig, t));
    setTesting(false);
  };

  // The graph new data is saved in is shown, not edited: changing it means
  // pressing "Change…" and confirming, since everyone writing to a repository
  // should agree on one.
  const dataGraph = dataGraphOf(localConfig);
  const usingDefaultGraph = dataGraph === DEFAULT_DATA_GRAPH;
  const [changingGraph, setChangingGraph] = useState(false);
  const [draftGraph, setDraftGraph] = useState("");
  const draftTrimmed = draftGraph.trim();
  const draftInvalid = draftTrimmed !== "" && isGraphSettingInvalid(draftTrimmed);
  const canConfirmGraph = draftTrimmed !== "" && !draftInvalid && draftTrimmed !== dataGraph;

  const startGraphChange = () => {
    setDraftGraph(dataGraph);
    setChangingGraph(true);
  };
  const confirmGraphChange = () => {
    setLocalConfig((current) => ({
      ...current,
      dataGraph: draftTrimmed === DEFAULT_DATA_GRAPH ? undefined : draftTrimmed,
    }));
    setChangingGraph(false);
  };
  const useDefaultGraph = () =>
    setLocalConfig((current) => ({ ...current, dataGraph: undefined }));

  const handleSave = () => {
    onConfigChange(
      { ...localConfig, dataGraph: localConfig.dataGraph?.trim() || undefined },
      localPreferences,
    );
    if (!isModal) {
      setExpanded(false);
    }
  };

  if (isModal) {
    return (
      <>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Settings sx={{ mr: 1 }} />
            {t("endpointConfig.title")}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("endpointConfig.connectionSection")}
          </Typography>
          <Box sx={{ pt: 1 }}>
            {/* The test sits beside the URL it tests, to save vertical space */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
              <TextField
                sx={{ flexGrow: 1 }}
                label={t("endpointConfig.endpointUrl")}
                value={localConfig.url}
                onChange={(e) => editConnection({ url: e.target.value })}
                helperText={t("endpointConfig.endpointUrlHelper")}
              />
              <Button
                variant="outlined"
                onClick={handleTest}
                disabled={testing || !connectionChanged || !localConfig.url.trim()}
                aria-label={t("wizard.test.testButton")}
                sx={{ height: 56, minWidth: 72, flexShrink: 0 }}
              >
                {testing ? <CircularProgress size={20} /> : t("endpointConfig.testConnection")}
              </Button>
            </Box>

            {testResult && (
              <Alert
                severity={testResult.success ? "success" : "error"}
                icon={testResult.success ? <CheckCircle /> : <ErrorIcon />}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">{testResult.message}</Typography>
                {testResult.details && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, whiteSpace: "pre-line" }}>
                    {testResult.details}
                  </Typography>
                )}
              </Alert>
            )}

            <TextField
              fullWidth
              label={t("endpointConfig.username")}
              value={localConfig.username || ""}
              onChange={(e) => editConnection({ username: e.target.value })}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={t("endpointConfig.password")}
              type="password"
              value={localConfig.password || ""}
              onChange={(e) => editConnection({ password: e.target.value })}
            />

            <Divider sx={{ my: 2 }} />
            <CatalogingStyleSettings
              preferences={localPreferences}
              onChange={setLocalPreferences}
            />

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              {t("endpointConfig.dataSection")}
            </Typography>
            <TextField
              fullWidth
              label={t("endpointConfig.dataGraph")}
              value={dataGraph}
              helperText={
                usingDefaultGraph
                  ? t("endpointConfig.dataGraphIsDefault")
                  : t("endpointConfig.dataGraphIsCustom", { graph: DEFAULT_DATA_GRAPH })
              }
              slotProps={{
                htmlInput: { readOnly: true },
                input: {
                  readOnly: true,
                  startAdornment: (
                    <Lock sx={{ fontSize: "0.9rem", color: "text.disabled", mr: 0.75 }} />
                  ),
                },
              }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button size="small" onClick={startGraphChange}>
                {t("endpointConfig.dataGraphChange")}
              </Button>
              {!usingDefaultGraph && (
                <Button size="small" onClick={useDefaultGraph}>
                  {t("endpointConfig.dataGraphUseDefault")}
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>{t("buttons.cancel")}</Button>
          {onResetConfiguration && (
            <Button onClick={onResetConfiguration} color="error">
              {t("endpointConfig.redoConfiguration")}
            </Button>
          )}
          <Button variant="contained" onClick={handleSave}>
            {t("buttons.save")}
          </Button>
        </DialogActions>

        <Dialog open={changingGraph} onClose={() => setChangingGraph(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t("endpointConfig.dataGraphChangeTitle")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t("endpointConfig.dataGraphChangeBody", { graph: DEFAULT_DATA_GRAPH })}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label={t("endpointConfig.dataGraph")}
              value={draftGraph}
              onChange={(e) => setDraftGraph(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirmGraph) confirmGraphChange();
              }}
              error={draftInvalid}
              helperText={
                draftInvalid
                  ? t("endpointConfig.dataGraphInvalid", { graph: DEFAULT_DATA_GRAPH })
                  : undefined
              }
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangingGraph(false)}>{t("buttons.cancel")}</Button>
            <Button variant="contained" onClick={confirmGraphChange} disabled={!canConfirmGraph}>
              {t("endpointConfig.dataGraphChangeConfirm")}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <Paper elevation={2} sx={{ mb: 3, maxWidth: 1248 }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 2 }}>
        <Settings sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {t("endpointConfig.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
          {config.url}
        </Typography>

        <IconButton onClick={() => setExpanded(!expanded)} sx={{ ml: 1 }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2, pt: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}>
            <TextField
              label={t("endpointConfig.endpointUrl")}
              value={localConfig.url}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, url: e.target.value })
              }
              helperText={t("endpointConfig.endpointUrlHelper")}
              sx={{ flexGrow: 1, mr: 2 }}
            />
            <Box sx={{ alignSelf: "center" }}>
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
              />
            </Box>
          </Box>

          <TextField
            fullWidth
            label={t("endpointConfig.username")}
            value={localConfig.username || ""}
            onChange={(e) =>
              setLocalConfig({ ...localConfig, username: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t("endpointConfig.password")}
            type="password"
            value={localConfig.password || ""}
            onChange={(e) =>
              setLocalConfig({ ...localConfig, password: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 2 }}>
            <CatalogingStyleSettings
              preferences={localPreferences}
              onChange={setLocalPreferences}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" onClick={handleSave}>
              {t("buttons.save")}
            </Button>

          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default EndpointConfig;
