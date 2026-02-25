import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
} from "@mui/material";
import { Add, Delete, Edit, Save, Cancel } from "@mui/icons-material";
import { useAvailableLanguages } from "../hooks/useSparqlQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface Label {
  id: string;
  value: string;
  language: string;
}

interface LabelManagerProps {
  open: boolean;
  onClose: () => void;
  onSave: (labels: Label[]) => void;
  initialLabels: Label[];
  config: SparqlEndpointConfig;
}

const LabelManager: React.FC<LabelManagerProps> = ({
  open,
  onClose,
  onSave,
  initialLabels,
  config,
}) => {
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [tempLanguage, setTempLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: availableLanguages, isLoading: languagesLoading } =
    useAvailableLanguages(config);

  useEffect(() => {
    setLabels(initialLabels);
  }, [initialLabels]);

  const handleAddLabel = () => {
    const newId = `new-${Date.now()}`;
    const newLabel: Label = {
      id: newId,
      value: "",
      language: "",
    };
    setLabels([...labels, newLabel]);
    setEditingId(newId);
    setTempValue("");
    setTempLanguage("");
    setError(null);
  };

  const handleEditLabel = (label: Label) => {
    setEditingId(label.id);
    setTempValue(label.value);
    setTempLanguage(label.language);
    setError(null);
  };

  const handleSaveLabel = () => {
    if (!tempValue.trim()) {
      setError("Label value cannot be empty");
      return;
    }

    // Check for duplicate language tags
    const existingLabel = labels.find(
      (l) => l.id !== editingId && l.language === tempLanguage
    );
    if (existingLabel) {
      setError(
        tempLanguage
          ? `A label with language "${tempLanguage}" already exists`
          : "A label without language tag already exists"
      );
      return;
    }

    setLabels(
      labels.map((label) =>
        label.id === editingId
          ? { ...label, value: tempValue.trim(), language: tempLanguage }
          : label
      )
    );
    setEditingId(null);
    setTempValue("");
    setTempLanguage("");
    setError(null);
  };

  const handleCancelEdit = () => {
    if (editingId?.startsWith("new-")) {
      // Remove the new label if it wasn't saved
      setLabels(labels.filter((label) => label.id !== editingId));
    }
    setEditingId(null);
    setTempValue("");
    setTempLanguage("");
    setError(null);
  };

  const handleDeleteLabel = (id: string) => {
    setLabels(labels.filter((label) => label.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setTempValue("");
      setTempLanguage("");
      setError(null);
    }
  };

  const handleSave = () => {
    if (editingId) {
      setError("Please save or cancel the current edit before saving");
      return;
    }
    console.log("LabelManager saving labels:", labels);
    onSave(labels);
  };

  const handleClose = () => {
    if (editingId) {
      setError("Please save or cancel the current edit before closing");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Edit />
          Manage Labels
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Add or edit labels for this entity. Each label can have a language
            tag or be language-neutral.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={handleAddLabel}
            disabled={!!editingId}
          >
            Add Label
          </Button>
        </Box>

        {labels.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No labels defined. Click "Add Label" to create one.
          </Typography>
        ) : (
          <Box>
            {labels.map((label) => (
              <Box key={label.id} sx={{ mb: 2 }}>
                {editingId === label.id ? (
                  <Box sx={{ p: 2, border: 1, borderColor: "primary.main", borderRadius: 1 }}>
                    <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                      <TextField
                        fullWidth
                        label="Label value"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        autoFocus
                        error={!tempValue.trim()}
                        helperText={!tempValue.trim() ? "Label value is required" : ""}
                      />
                      <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel>Language</InputLabel>
                        <Select
                          value={tempLanguage}
                          label="Language"
                          onChange={(e) => setTempLanguage(e.target.value)}
                          disabled={languagesLoading}
                        >
                          <MenuItem value="">
                            <em>No language</em>
                          </MenuItem>
                          {availableLanguages?.map((lang) => (
                            <MenuItem key={lang} value={lang}>
                              {lang.toUpperCase()}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Save />}
                        onClick={handleSaveLabel}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Cancel />}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                        {label.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {label.language ? `Language: ${label.language.toUpperCase()}` : "No language tag"}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditLabel(label)}
                        disabled={!!editingId}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteLabel(label.id)}
                        disabled={!!editingId}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )}
                {label.id !== labels[labels.length - 1].id && <Divider sx={{ mt: 1 }} />}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={!!editingId}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!!editingId}
          startIcon={<Save />}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LabelManager;