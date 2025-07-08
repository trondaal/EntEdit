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
} from "@mui/material";
import { ExpandMore, ExpandLess, Settings } from "@mui/icons-material";
import type { SparqlEndpointConfig } from "../types/sparql";
import LanguageSelector from "./LanguageSelector";

interface EndpointConfigProps {
  config: SparqlEndpointConfig;
  onConfigChange: (config: SparqlEndpointConfig) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  isModal?: boolean;
}

const EndpointConfig: React.FC<EndpointConfigProps> = ({
  config,
  onConfigChange,
  selectedLanguage,
  onLanguageChange,
  isModal = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    onConfigChange(localConfig);
    if (!isModal) {
      setExpanded(false);
    }
  };

  const handleReset = () => {
    setLocalConfig(config);
  };

  if (isModal) {
    return (
      <>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Settings sx={{ mr: 1 }} />
            SPARQL Endpoint Configuration
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="SPARQL Endpoint URL"
              value={localConfig.url}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, url: e.target.value })
              }
              helperText="Enter the URL of your SPARQL endpoint"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Username (optional)"
              value={localConfig.username || ""}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, username: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Password (optional)"
              type="password"
              value={localConfig.password || ""}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, password: e.target.value })
              }
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReset}>
            Reset
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Save Configuration
          </Button>
        </DialogActions>
      </>
    );
  }

  return (
    <Paper elevation={2} sx={{ mb: 3, maxWidth: 1248 }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 2 }}>
        <Settings sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          SPARQL Endpoint Configuration
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
          <Box
            sx={{ display: "flex", alignItems: "flex-start", mb: 2 }}
          >
            <TextField
              label="SPARQL Endpoint URL"
              value={localConfig.url}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, url: e.target.value })
              }
              helperText="Enter the URL of your SPARQL endpoint"
              sx={{ flexGrow: 1, mr: 2 }}
            />
            <Box sx={{ alignSelf: "center" }}>
              <LanguageSelector
                config={config}
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
              />
            </Box>
          </Box>

          <TextField
            fullWidth
            label="Username (optional)"
            value={localConfig.username || ""}
            onChange={(e) =>
              setLocalConfig({ ...localConfig, username: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Password (optional)"
            type="password"
            value={localConfig.password || ""}
            onChange={(e) =>
              setLocalConfig({ ...localConfig, password: e.target.value })
            }
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" onClick={handleSave}>
              Save Configuration
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default EndpointConfig;
