import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Container, Box, CircularProgress, Typography } from "@mui/material";
import { queryClient } from "./utils/queryClient";
import AppHeader from "./components/AppHeader";
import EntityBrowser from "./components/EntityBrowser";
import ConfigurationWizard from "./components/ConfigurationWizard";
import type { SparqlEndpointConfig } from "./types/sparql";
import { 
  loadConfiguration, 
  saveConfiguration, 
  clearConfiguration,
  getDefaultConfiguration,
  type AppConfiguration 
} from "./utils/configManager";

const theme = createTheme({
  components: {
    MuiInputBase: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            color: "rgba(0, 0, 0, 0.8)", // Much darker than default disabled color
            "-webkit-text-fill-color": "rgba(0, 0, 0, 0.8)", // Override webkit autofill
          },
        },
        input: {
          "&.Mui-disabled": {
            color: "rgba(0, 0, 0, 0.8)", // Ensure input text is also darker
            "-webkit-text-fill-color": "rgba(0, 0, 0, 0.8)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.23)", // Keep border visible
            },
          },
        },
      },
    },
  },
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
  typography: {
    subtitle1: {
      color: "#1976d2", // Change to your desired color
      fontWeight: 400,
    },
  },
});

function App() {
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Load configuration on app start
  useEffect(() => {
    const savedConfig = loadConfiguration();
    
    if (savedConfig && savedConfig.isConfigured) {
      setAppConfig(savedConfig);
      setShowWizard(false);
    } else {
      setAppConfig(getDefaultConfiguration());
      setShowWizard(true);
    }
    
    setLoading(false);
  }, []);

  const handleConfigurationComplete = (config: SparqlEndpointConfig, language: string) => {
    // Save to localStorage
    saveConfiguration(config, language);
    
    // Update app state
    const newAppConfig: AppConfiguration = {
      endpoint: config,
      language,
      isConfigured: true,
    };
    
    setAppConfig(newAppConfig);
    setShowWizard(false);
  };

  const handleConfigChange = (newConfig: SparqlEndpointConfig) => {
    if (appConfig) {
      const updatedConfig = {
        ...appConfig,
        endpoint: newConfig,
      };
      setAppConfig(updatedConfig);
      saveConfiguration(newConfig, appConfig.language);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    if (appConfig) {
      const updatedConfig = {
        ...appConfig,
        language: newLanguage,
      };
      setAppConfig(updatedConfig);
      saveConfiguration(appConfig.endpoint, newLanguage);
    }
  };

  const handleResetConfiguration = () => {
    // Clear stored configuration
    clearConfiguration();
    
    // Reset to default state and show wizard
    setAppConfig(getDefaultConfiguration());
    setShowWizard(true);
  };

  // Show loading spinner while determining configuration state
  if (loading) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Loading EntEdit...
            </Typography>
          </Box>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        
        {/* Configuration Wizard - shown on first run or if config is invalid */}
        <ConfigurationWizard
          open={showWizard}
          onConfigurationComplete={handleConfigurationComplete}
          initialConfig={appConfig?.endpoint}
          initialLanguage={appConfig?.language}
        />

        {/* Main Application - only rendered when properly configured */}
        {appConfig?.isConfigured && !showWizard && (
          <>
            <AppHeader
              config={appConfig.endpoint}
              onConfigChange={handleConfigChange}
              selectedLanguage={appConfig.language}
              onLanguageChange={handleLanguageChange}
              onResetConfiguration={handleResetConfiguration}
            />
            <Box
              sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                pt: "64px", // Account for fixed header height
              }}
            >
              <Container maxWidth="xl" sx={{ py: 3, px: 2, flexGrow: 1 }}>
                <EntityBrowser
                  config={appConfig.endpoint}
                  selectedLanguage={appConfig.language}
                />
              </Container>
            </Box>
          </>
        )}
        
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
