import { useState, useEffect, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Container, Box, CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SnackbarProvider } from "notistack";
import { queryClient } from "./utils/queryClient";
import AppHeader from "./components/AppHeader";
const EntityBrowser = lazy(() => import("./components/EntityBrowser"));
const SearchInterface = lazy(() => import("./components/SearchInterface"));
const ConfigurationWizard = lazy(() => import("./components/ConfigurationWizard"));
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
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.23)", // Keep border visible
            },
          },
          "&:focus-within": {
            boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.2)", // Focus ring for accessibility
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "#1976d2",
            outlineOffset: "2px",
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "#1976d2",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "#1976d2",
            outlineOffset: "2px",
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
    text: {
      disabled: "rgba(0, 0, 0, 0.55)", // Improved contrast for accessibility
    },
  },
  typography: {
    subtitle1: {
      color: "rgba(0, 0, 0, 0.6)",
      fontWeight: 600,
    },
  },
});

function App() {
  const { t, i18n } = useTranslation();
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Check if search tab should be hidden based on URL parameter
  // By default, search tab is shown unless 'nosearch' parameter is present
  const showSearchTab = !new URLSearchParams(window.location.search).has('nosearch');

  // Sync i18next language with app language selection
  useEffect(() => {
    if (appConfig?.language) {
      i18n.changeLanguage(appConfig.language);
    }
  }, [appConfig?.language, i18n]);

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
              {t("labels.loading")}
            </Typography>
          </Box>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <CssBaseline />

          {/* Configuration Wizard - shown on first run or if config is invalid */}
          <Suspense fallback={null}>
            <ConfigurationWizard
              open={showWizard}
              onConfigurationComplete={handleConfigurationComplete}
              initialConfig={appConfig?.endpoint}
              initialLanguage={appConfig?.language}
            />
          </Suspense>

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
                <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                  <Container maxWidth="xl">
                    <Tabs
                      value={activeTab}
                      onChange={(_, newValue) => setActiveTab(newValue)}
                      aria-label="main navigation tabs"
                    >
                      <Tab label={t("tabs.entityBrowser")} />
                      {showSearchTab && <Tab label={t("tabs.search")} />}
                    </Tabs>
                  </Container>
                </Box>

                <Container maxWidth="xl" sx={{ py: 3, px: 2, flexGrow: 1 }}>
                  <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>}>
                    {activeTab === 0 && (
                      <EntityBrowser
                        config={appConfig.endpoint}
                        selectedLanguage={appConfig.language}
                      />
                    )}
                    {activeTab === 1 && showSearchTab && (
                      <SearchInterface
                        config={appConfig.endpoint}
                        selectedLanguage={appConfig.language}
                      />
                    )}
                  </Suspense>
                </Container>
              </Box>
            </>
          )}

          <ReactQueryDevtools initialIsOpen={false} />
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
