import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SnackbarProvider } from "notistack";
import { queryClient } from "./utils/queryClient";
import { invalidateAllEntityData } from "./utils/queryInvalidation";
import { LoggingProvider } from "./contexts/LoggingContext";
import { useLogging } from "./hooks/useLogging";
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

const DEMO_ENDPOINT_URL = "http://dijon.idi.ntnu.no:8080/repositories/EntEdit";

const theme = createTheme({
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.23)",
            },
          },
          "&:focus-within": {
            boxShadow: "0 0 0 3px rgba(139, 92, 42, 0.18)",
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "#8B5C2A",
            outlineOffset: "2px",
            backgroundColor: "rgba(139, 92, 42, 0.06)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(139, 92, 42, 0.10)",
            "&:hover": {
              backgroundColor: "rgba(139, 92, 42, 0.15)",
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "#8B5C2A",
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
            outlineColor: "#8B5C2A",
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(135deg, #3D2E1F 0%, #5C3D2E 100%)",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          letterSpacing: "0.02em",
          "&.Mui-selected": {
            fontWeight: 600,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderColor: "rgba(139, 92, 42, 0.12)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
  palette: {
    mode: "light",
    primary: {
      main: "#8B5C2A",
      light: "#B07D3A",
      dark: "#5C3D1C",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#C2713A",
      light: "#E09060",
      dark: "#8E4F24",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FAF8F5",
      paper: "#FFFFFF",
    },
    text: {
      primary: "rgba(45, 30, 15, 0.87)",
      secondary: "rgba(45, 30, 15, 0.60)",
      disabled: "rgba(45, 30, 15, 0.45)",
    },
    divider: "rgba(139, 92, 42, 0.12)",
    info: {
      main: "#5B7FA4",
      light: "#E8F0F7",
      dark: "#3D5A7A",
      contrastText: "#1A3A5C",
    },
    success: {
      main: "#5A8A5C",
      light: "#E6F2E6",
      dark: "#3D6B3F",
      contrastText: "#1A3D1C",
    },
    warning: {
      main: "#C2713A",
      light: "#FFF3E0",
      dark: "#8E4F24",
    },
    error: {
      main: "#C0392B",
      light: "#FDECEA",
      dark: "#8B2820",
    },
    grey: {
      50: "#FAF8F5",
      100: "#F5F0EB",
      200: "#E8E0D8",
      300: "#D4C8BC",
      400: "#B0A090",
      500: "#8C7A68",
      600: "#6B5B4D",
      700: "#4A3D32",
      800: "#3D2E1F",
      900: "#2A1F14",
    },
    action: {
      hover: "rgba(139, 92, 42, 0.06)",
      selected: "rgba(139, 92, 42, 0.10)",
      focus: "rgba(139, 92, 42, 0.12)",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    subtitle1: {
      color: "rgba(45, 30, 15, 0.60)",
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
  },
});

function App() {
  return (
    <LoggingProvider>
      <AppInner />
    </LoggingProvider>
  );
}

function AppInner() {
  const { t, i18n } = useTranslation();
  const [appConfig, setAppConfig] = useState<AppConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  // Refs holding the active editor's save / discard functions (if any).
  // EntityEditor registers/unregisters these based on its dirty state, so the
  // header Refresh button can offer "Save & refresh" and "Discard & refresh"
  // without prop-drilling the editor's mutators back up through the tree.
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const discardHandlerRef = useRef<(() => void) | null>(null);
  const registerEditorSave = useCallback(
    (handler: (() => Promise<void>) | null) => {
      saveHandlerRef.current = handler;
    },
    [],
  );
  const registerEditorDiscard = useCallback(
    (handler: (() => void) | null) => {
      discardHandlerRef.current = handler;
    },
    [],
  );
  const handleRefresh = useCallback(async (saveFirst: boolean) => {
    if (saveFirst) {
      if (saveHandlerRef.current) await saveHandlerRef.current();
    } else if (discardHandlerRef.current) {
      // Dirty + user chose Discard: reset editor state so the refetched data
      // is actually shown (EntityEditor guards against clobbering unsaved edits).
      discardHandlerRef.current();
    }
    invalidateAllEntityData(queryClient);
  }, []);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const showSearchTab = useMemo(() => !urlParams.has("nosearch"), [urlParams]);
  const showLogging = useMemo(() => !urlParams.has("nologging"), [urlParams]);
  const isDemoMode = useMemo(() => urlParams.has("demo"), [urlParams]);

  const { logEvent, isRecording } = useLogging();

  // Sync i18next language with app language selection
  useEffect(() => {
    if (appConfig?.language) {
      i18n.changeLanguage(appConfig.language);
    }
  }, [appConfig?.language, i18n]);

  // Load configuration on app start
  useEffect(() => {
    if (isDemoMode) {
      const savedConfig = loadConfiguration();
      setAppConfig({
        endpoint: { url: DEMO_ENDPOINT_URL, username: "", password: "" },
        language: savedConfig?.language ?? "en",
        isConfigured: true,
        warnAutoUri: savedConfig?.warnAutoUri ?? false,
        warnAutoLabel: savedConfig?.warnAutoLabel ?? false,
      });
      setShowWizard(false);
      setLoading(false);
      return;
    }

    const savedConfig = loadConfiguration();

    if (savedConfig && savedConfig.isConfigured) {
      setAppConfig(savedConfig);
      setShowWizard(false);
    } else {
      setAppConfig(getDefaultConfiguration());
      setShowWizard(true);
    }

    setLoading(false);
  }, [isDemoMode]);

  const handleConfigurationComplete = (
    config: SparqlEndpointConfig,
    language: string,
    preferences: { warnAutoUri: boolean; warnAutoLabel: boolean },
  ) => {
    // Save to localStorage
    saveConfiguration(config, language, preferences);

    // Update app state
    const newAppConfig: AppConfiguration = {
      endpoint: config,
      language,
      isConfigured: true,
      warnAutoUri: preferences.warnAutoUri,
      warnAutoLabel: preferences.warnAutoLabel,
    };

    setAppConfig(newAppConfig);
    setShowWizard(false);
  };

  const handleConfigChange = (newConfig: SparqlEndpointConfig, warnAutoUri: boolean, warnAutoLabel: boolean) => {
    if (appConfig) {
      const updatedConfig = {
        ...appConfig,
        endpoint: newConfig,
        warnAutoUri,
        warnAutoLabel,
      };
      setAppConfig(updatedConfig);
      if (!isDemoMode) {
        saveConfiguration(newConfig, appConfig.language, { warnAutoUri, warnAutoLabel });
      }
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    if (appConfig) {
      const updatedConfig = {
        ...appConfig,
        language: newLanguage,
      };
      setAppConfig(updatedConfig);
      if (!isDemoMode) {
        saveConfiguration(appConfig.endpoint, newLanguage);
      }
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
            <Box
              sx={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <AppHeader
                config={appConfig.endpoint}
                onConfigChange={handleConfigChange}
                selectedLanguage={appConfig.language}
                onLanguageChange={handleLanguageChange}
                onResetConfiguration={handleResetConfiguration}
                showLogging={showLogging}
                warnAutoUri={appConfig.warnAutoUri}
                warnAutoLabel={appConfig.warnAutoLabel}
                isDirty={isEditorDirty}
                onRefresh={handleRefresh}
              />
              <Box
                sx={{
                  maxWidth: 1536,
                  width: "100%",
                  mx: "auto",
                  px: { xs: 2, sm: 3, md: 4 },
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                  <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => {
                      setActiveTab(newValue);
                      if (isRecording) {
                        logEvent({
                          type: "tab_switched",
                          tab: newValue === 0 ? "entityBrowser" : "search",
                        });
                      }
                    }}
                    aria-label="main navigation tabs"
                  >
                    <Tab label={t("tabs.entityBrowser")} />
                    {showSearchTab && <Tab label={t("tabs.search")} />}
                  </Tabs>
                </Box>

                <Box sx={{ py: 3, flexGrow: 1 }}>
                  <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}><CircularProgress /></Box>}>
                    {activeTab === 0 && (
                      <EntityBrowser
                        config={appConfig.endpoint}
                        selectedLanguage={appConfig.language}
                        warnAutoUri={appConfig.warnAutoUri}
                        warnAutoLabel={appConfig.warnAutoLabel}
                        onEditingChange={setIsEditorDirty}
                        onRegisterSave={registerEditorSave}
                        onRegisterDiscard={registerEditorDiscard}
                      />
                    )}
                    {activeTab === 1 && showSearchTab && (
                      <SearchInterface
                        config={appConfig.endpoint}
                        selectedLanguage={appConfig.language}
                      />
                    )}
                  </Suspense>
                </Box>
              </Box>
            </Box>
          )}

          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
