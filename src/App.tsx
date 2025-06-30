import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Typography, Box } from '@mui/material';
import { queryClient } from './utils/queryClient';
import EndpointConfig from './components/EndpointConfig';
import EntityBrowser from './components/EntityBrowser';
import type { SparqlEndpointConfig } from './types/sparql';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [endpointConfig, setEndpointConfig] = useState<SparqlEndpointConfig>({
    url: '/graphdb/repositories/EntEdit',
    username: 'admin',
    password: 'letmein',
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="xl" sx={{ pt: 3, pb: 2, px: 2, alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: '100vh'  }}>
          <Box sx={{ mb: 3, textAlign: 'left' }}>
            <Typography variant="h4" component="h1" sx={{ 
              fontWeight: 'bold',
              color: 'primary.main',
              mb: 1
            }}>
              Entity-oriented metadata
            </Typography>
          </Box>
          
          <EndpointConfig 
            config={endpointConfig} 
            onConfigChange={setEndpointConfig}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
          />
          <EntityBrowser 
            config={endpointConfig} 
            selectedLanguage={selectedLanguage}
          />
        </Container>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App
