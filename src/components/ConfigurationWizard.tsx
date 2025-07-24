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
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import LanguageSelector from "./LanguageSelector";

interface ConfigurationWizardProps {
  open: boolean;
  onConfigurationComplete: (
    config: SparqlEndpointConfig,
    language: string,
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
  const [activeStep, setActiveStep] = useState(0);
  const [config, setConfig] = useState<SparqlEndpointConfig>(
    initialConfig || {
      url: "",
      username: "",
      password: "",
    },
  );
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const steps = [
    "Database Connection",
    "Test Connection",
    "Language Selection",
  ];

  const testConnection = async () => {
    if (!config.url.trim()) {
      setTestResult({
        success: false,
        message: "Please enter a SPARQL endpoint URL",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // First, try a basic connectivity test without authentication
      console.log("Testing basic connectivity to:", config.url);

      try {
        const basicResponse = await fetch(config.url, {
          method: "OPTIONS",
          credentials: "include",
          //mode: "cors",
        });
        console.log("Basic connectivity test result:", {
          status: basicResponse.status,
          ok: basicResponse.ok,
        });
      } catch (basicError) {
        console.log("Basic connectivity failed:", basicError);
      }

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

      console.log(
        "Testing SPARQL query with authentication:",
        !!config.username,
      );
      const response = await client.query(testQuery);

      if (response.results.bindings.length > 0) {
        setTestResult({
          success: true,
          message: "Connection successful!",
          details: `Connected to SPARQL endpoint. Database contains data.`,
        });
        setActiveStep(2); // Move to language selection
      } else {
        setTestResult({
          success: true,
          message: "Connection successful, but database appears to be empty",
          details: "The endpoint is reachable but no triples were found.",
        });
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      let enhancedMessage = "Connection failed";
      let enhancedDetails = errorMessage;

      // Provide specific guidance for common authentication errors
      if (errorMessage.includes("401")) {
        enhancedMessage = "Authentication failed (401 Unauthorized)";
        enhancedDetails =
          "The username or password is incorrect. Please check your credentials and try again.";
      } else if (errorMessage.includes("403")) {
        enhancedMessage = "Access forbidden (403 Forbidden)";
        enhancedDetails =
          "Your account doesn't have permission to access this endpoint. Contact your database administrator.";
      } else if (errorMessage.includes("404")) {
        enhancedMessage = "Endpoint not found (404)";
        enhancedDetails =
          "The SPARQL endpoint URL is incorrect or the database is not running. Please verify the URL.";
      } else if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Load failed")
      ) {
        enhancedMessage = "Network connection failed";
        enhancedDetails =
          "Cannot reach the database server. This could be:\n• Database server is not running\n• URL is incorrect\n• CORS (Cross-Origin) policy blocking the request\n• Firewall or network restrictions\n• SSL/TLS certificate issues if using HTTPS\n\nTry accessing the URL directly in your browser to test connectivity.";
      } else if (errorMessage.includes("CORS")) {
        enhancedMessage = "CORS (Cross-Origin) error";
        enhancedDetails =
          "The database server needs to allow requests from this application. For GraphDB, add these CORS headers:\n• Access-Control-Allow-Origin: *\n• Access-Control-Allow-Methods: GET, POST, OPTIONS\n• Access-Control-Allow-Headers: Content-Type, Authorization";
      }

      console.error("Connection test failed:", error);
      console.log("Config used:", {
        url: config.url,
        hasUsername: !!config.username,
        hasPassword: !!config.password,
      });

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
    onConfigurationComplete(config, selectedLanguage);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ minHeight: 300 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Configure Database Connection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your SPARQL endpoint details. This information will be
              stored locally in your browser.
            </Typography>

            <TextField
              fullWidth
              label="SPARQL Endpoint URL"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              helperText="e.g., http://localhost:7200/repositories/EntEdit"
              sx={{ mb: 2 }}
              placeholder="http://localhost:7200/repositories/EntEdit"
            />

            <TextField
              fullWidth
              label="Username (optional)"
              value={config.username || ""}
              onChange={(e) =>
                setConfig({ ...config, username: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Password (optional)"
              type="password"
              value={config.password || ""}
              onChange={(e) =>
                setConfig({ ...config, password: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <Paper
              sx={{ p: 2, bgcolor: "info.light", color: "info.contrastText" }}
            >
              <Typography variant="body2">
                <strong>Popular SPARQL Endpoints:</strong>
              </Typography>
              <List dense>
                <ListItem disablePadding>
                  <ListItemText
                    primary="GraphDB: http://localhost:7200/repositories/[repository]"
                    secondary="Default GraphDB local installation"
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary="Fuseki: http://localhost:3030/[dataset]/sparql"
                    secondary="Apache Jena Fuseki server"
                  />
                </ListItem>
                <ListItem disablePadding>
                  <ListItemText
                    primary="Stardog: http://localhost:5820/[database]/query"
                    secondary="Stardog graph database"
                  />
                </ListItem>
              </List>
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
              Test Database Connection
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3, textAlign: "center" }}
            >
              We'll test the connection to ensure your endpoint is accessible.
            </Typography>

            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                <strong>Endpoint:</strong> {config.url}
              </Typography>
              {config.username && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Username:</strong> {config.username}
                </Typography>
              )}
            </Box>

            {testing && (
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography>Testing connection...</Typography>
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
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ minHeight: 300 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Select Default Language
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose your preferred language for labels and interface text. You
              can change this later.
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
              <Language />
              <LanguageSelector
                config={config}
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
              />
            </Box>

            <Paper
              sx={{
                p: 2,
                bgcolor: "success.light",
                color: "success.contrastText",
              }}
            >
              <Typography
                variant="body1"
                sx={{ display: "flex", alignItems: "center" }}
              >
                <CheckCircle sx={{ mr: 1 }} />
                Configuration Complete!
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Your configuration will be saved locally and the application
                will connect to your database.
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
            Next: Test Connection
          </Button>
        );
      case 1:
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => setActiveStep(2)}
              disabled={!testResult?.success}
            >
              Next: Language
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => setActiveStep(1)}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleComplete}
              color="success"
            >
              Complete Setup
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
      disableEscapeKeyDown
      sx={{
        "& .MuiDialog-paper": {
          minHeight: 500,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Storage sx={{ mr: 1 }} />
          Database Configuration
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
