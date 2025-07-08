import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Container, Box, colors } from "@mui/material";
import { queryClient } from "./utils/queryClient";
import AppHeader from "./components/AppHeader";
import EntityBrowser from "./components/EntityBrowser";
import type { SparqlEndpointConfig } from "./types/sparql";

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
  const [endpointConfig, setEndpointConfig] = useState<SparqlEndpointConfig>({
    url: "/graphdb/repositories/EntEdit",
    username: "admin",
    password: "letmein",
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppHeader
          config={endpointConfig}
          onConfigChange={setEndpointConfig}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
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
              config={endpointConfig}
              selectedLanguage={selectedLanguage}
            />
          </Container>
        </Box>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
