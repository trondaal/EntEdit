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
  Divider,
} from "@mui/material";
import { ExpandMore, ExpandLess, Settings } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import CatalogingStyleSettings from "./CatalogingStyleSettings";
import type { CatalogingPreferences } from "../utils/catalogingStyle";
import type { SparqlEndpointConfig } from "../types/sparql";
import LanguageSelector from "./LanguageSelector";

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

  const handleSave = () => {
    onConfigChange(localConfig, localPreferences);
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
            <TextField
              fullWidth
              label={t("endpointConfig.endpointUrl")}
              value={localConfig.url}
              onChange={(e) =>
                setLocalConfig({ ...localConfig, url: e.target.value })
              }
              helperText={t("endpointConfig.endpointUrlHelper")}
              sx={{ mb: 2 }}
            />

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
            <CatalogingStyleSettings
              preferences={localPreferences}
              onChange={setLocalPreferences}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>{t("endpointConfig.cancel")}</Button>
          {onResetConfiguration && (
            <Button onClick={onResetConfiguration} color="error">
              {t("endpointConfig.reconfigureDatabase")}
            </Button>
          )}
          <Button variant="contained" onClick={handleSave}>
            {t("endpointConfig.saveConfiguration")}
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
              {t("endpointConfig.saveConfiguration")}
            </Button>

          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default EndpointConfig;
