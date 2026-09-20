import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { Storage, CheckCircle, Error, Language } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import CatalogingStyleSettings from "./CatalogingStyleSettings";
import {
  DEFAULT_PREFERENCES,
  type CatalogingPreferences,
} from "../utils/catalogingStyle";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import LanguageSelector from "./LanguageSelector";

interface ConfigurationWizardProps {
  open: boolean;
  onConfigurationComplete: (
    config: SparqlEndpointConfig,
    language: string,
    preferences: CatalogingPreferences,
  ) => void;
  initialConfig?: SparqlEndpointConfig;
  initialLanguage?: string;
}

const ConfigurationWizard: React.FC<ConfigurationWizardProps> = ({
  open,
  onConfigurationComplete,
  initialConfig,
  initialLanguage = "en",
}) => {
  const { t } = useTranslation("common");
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<SparqlEndpointConfig>(
    initialConfig || {
      url: "",
      username: "",
      password: "",
    },
  );
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [preferences, setPreferences] = useState<CatalogingPreferences>(DEFAULT_PREFERENCES);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const steps = [
    t("wizard.steps.connection"),
    t("wizard.steps.test"),
    t("wizard.steps.language"),
    t("wizard.steps.settings"),
  ];

  const testConnection = async () => {
    if (!config.url.trim()) {
      setTestResult({
        success: false,
        message: t("wizard.testResult.noUrl"),
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Now test with full SPARQL query
      const client = new SparqlClient(config);

      // Test with a simple query
      const testQuery = `
        SELECT (COUNT(*) as ?count)
        WHERE {
          ?s ?p ?o .
        }
        LIMIT 1
      `;

      const response = await client.query(testQuery);

      if (response.results.bindings.length > 0) {
        setTestResult({
          success: true,
          message: t("wizard.testResult.success"),
          details: t("wizard.testResult.successDetails"),
        });
        setActiveStep(2); // Move to language selection
      } else {
        setTestResult({
          success: true,
          message: t("wizard.testResult.empty"),
          details: t("wizard.testResult.emptyDetails"),
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      let enhancedMessage = t("wizard.testResult.failed");
      let enhancedDetails = errorMessage;

      // Provide specific guidance for common authentication errors
      if (errorMessage.includes("401")) {
        enhancedMessage = t("wizard.testResult.unauthorized");
        enhancedDetails = t("wizard.testResult.unauthorizedDetails");
      } else if (errorMessage.includes("403")) {
        enhancedMessage = t("wizard.testResult.forbidden");
        enhancedDetails = t("wizard.testResult.forbiddenDetails");
      } else if (errorMessage.includes("404")) {
        enhancedMessage = t("wizard.testResult.notFound");
        enhancedDetails = t("wizard.testResult.notFoundDetails");
      } else if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Load failed")
      ) {
        enhancedMessage = t("wizard.testResult.network");
        enhancedDetails = t("wizard.testResult.networkDetails");
      } else if (errorMessage.includes("CORS")) {
        enhancedMessage = t("wizard.testResult.cors");
        enhancedDetails = t("wizard.testResult.corsDetails");
      }

      setTestResult({
        success: false,
        message: enhancedMessage,
        details: enhancedDetails,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = () => {
    onConfigurationComplete(config, selectedLanguage, preferences);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ minHeight: 300 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("wizard.connection.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t("wizard.connection.description")}
            </Typography>

            <TextField
              fullWidth
              label={t("wizard.connection.urlLabel")}
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              helperText={t("wizard.connection.urlHelper")}
              sx={{ mb: 2 }}
              placeholder={t("wizard.connection.urlPlaceholder")}
            />

            <TextField
              fullWidth
              label={t("wizard.connection.usernameLabel")}
              value={config.username || ""}
              onChange={(e) =>
                setConfig({ ...config, username: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={t("wizard.connection.passwordLabel")}
              type="password"
              value={config.password || ""}
              onChange={(e) =>
                setConfig({ ...config, password: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <Paper
              sx={{ p: 2, bgcolor: "info.light", color: "info.dark" }}
            >
              <Typography variant="body2">
                <strong>{t("wizard.connection.popularEndpoints")}</strong>
              </Typography>
              <List dense>
                <ListItem disablePadding>
                  <ListItemText
                    primary={t("wizard.connection.graphdbDocker")}
                    secondary={t("wizard.connection.graphdbDockerHint")}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary={t("wizard.connection.graphdbServer")}
                    secondary={t("wizard.connection.graphdbServerHint")}
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary={t("wizard.connection.graphdbPort")}
                    secondary={t("wizard.connection.graphdbPortHint")}
                  />
                </ListItem>
              </List>
              <Typography variant="caption">
                {t("wizard.connection.endpointsNote")}
              </Typography>
            </Paper>
          </Box>
        );

      case 1:
        return (
          <Box
            sx={{
              minHeight: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("wizard.test.title")}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3, textAlign: "center" }}
            >
              {t("wizard.test.description")}
            </Typography>

            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>{t("wizard.test.endpointLabel")}</strong> {config.url}
              </Typography>
              {config.username && (
                <Typography variant="body2" color="text.secondary">
                  <strong>{t("wizard.test.usernameLabel")}</strong> {config.username}
                </Typography>
              )}
            </Box>

            {testing && (
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography>{t("wizard.test.testing")}</Typography>
              </Box>
            )}

            {testResult && (
              <Alert
                severity={testResult.success ? "success" : "error"}
                sx={{ mb: 2, width: "100%" }}
                icon={testResult.success ? <CheckCircle /> : <Error />}
              >
                <Typography variant="body1">{testResult.message}</Typography>
                {testResult.details && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {testResult.details}
                  </Typography>
                )}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={testConnection}
              disabled={testing || !config.url.trim()}
              sx={{ minWidth: 120 }}
            >
              {testing ? t("wizard.test.testingButton") : t("wizard.test.testButton")}
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ minHeight: 300 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("wizard.languageStep.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t("wizard.languageStep.description")}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Language />
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
              />
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ minHeight: 300 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("wizard.settingsStep.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t("wizard.settingsStep.description")}
            </Typography>

            <Box sx={{ mb: 3 }}>
              <CatalogingStyleSettings
                hideHeading
                preferences={preferences}
                onChange={setPreferences}
              />
            </Box>

            <Paper
              sx={{
                p: 2,
                bgcolor: "success.light",
                color: "success.dark",
              }}
            >
              <Typography
                variant="body1"
                sx={{ display: "flex", alignItems: "center" }}
              >
                <CheckCircle sx={{ mr: 1 }} />
                {t("wizard.languageStep.successTitle")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t("wizard.languageStep.successDescription")}
              </Typography>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  const getStepActions = () => {
    switch (activeStep) {
      case 0:
        return (
          <Button
            variant="contained"
            onClick={() => setActiveStep(1)}
            disabled={!config.url.trim()}
          >
            {t("wizard.buttons.nextTest")}
          </Button>
        );
      case 1:
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              {t("wizard.buttons.back")}
            </Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep(2)}
              disabled={!testResult?.success}
            >
              {t("wizard.buttons.nextLanguage")}
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setActiveStep(1)}>
              {t("wizard.buttons.back")}
            </Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep(3)}
            >
              {t("wizard.buttons.nextSettings")}
            </Button>
          </Box>
        );
      case 3:
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setActiveStep(2)}>
              {t("wizard.buttons.back")}
            </Button>
            <Button
              variant="contained"
              onClick={handleComplete}
              color="success"
            >
              {t("wizard.buttons.complete")}
            </Button>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          minHeight: 500,
        },
      }}
    >
      {/* One title for the whole flow: the stepper and each step's own
          heading say which aspect is being configured. */}
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Storage sx={{ mr: 1 }} />
          {t("wizard.title")}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent(activeStep)}
      </DialogContent>

      <DialogActions>{getStepActions()}</DialogActions>
    </Dialog>
  );
};

export default ConfigurationWizard;
