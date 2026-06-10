import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { Close, UploadFile } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { useQueryClient } from "@tanstack/react-query";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient, SparqlError } from "../utils/sparqlClient";
import { invalidateAllEntityData } from "../utils/queryInvalidation";

const DEFAULT_GRAPH_URI = "http://oslomet.no/abi/examples";

const ACCEPTED_EXTENSIONS = [".ttl", ".nt", ".rdf"] as const;

const contentTypeFor = (filename: string): string | null => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ttl")) return "text/turtle";
  if (lower.endsWith(".nt")) return "application/n-triples";
  if (lower.endsWith(".rdf")) return "application/rdf+xml";
  return null;
};

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  config: SparqlEndpointConfig;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onClose,
  config,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [graphUri, setGraphUri] = useState<string>(DEFAULT_GRAPH_URI);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reset form fields when the dialog opens */
  useEffect(() => {
    if (open) {
      setFile(null);
      setGraphUri(DEFAULT_GRAPH_URI);
      setError(null);
      setImporting(false);
    }
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  };

  const handleImport = useCallback(async () => {
    if (!file) return;
    const ctype = contentTypeFor(file.name);
    if (!ctype) {
      setError(t("dialogs.import.errors.unknownFormat"));
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const client = new SparqlClient(config);
      await client.import(file, ctype, graphUri);
      invalidateAllEntityData(queryClient);
      enqueueSnackbar(
        t("dialogs.import.success", { filename: file.name }),
        { variant: "success", autoHideDuration: 4000 },
      );
      onClose();
    } catch (err) {
      const message =
        err instanceof SparqlError
          ? err.message
          : (err as Error).message ?? "Unknown error";
      setError(message);
    } finally {
      setImporting(false);
    }
  }, [file, graphUri, config, queryClient, enqueueSnackbar, onClose, t]);

  return (
    <Dialog
      open={open}
      onClose={() => !importing && onClose()}
      maxWidth="sm"
      fullWidth
      aria-labelledby="import-dialog-title"
    >
      <DialogTitle
        id="import-dialog-title"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        {t("dialogs.import.title")}
        <IconButton
          aria-label={t("buttons.close")}
          onClick={onClose}
          disabled={importing}
          size="small"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("dialogs.import.description")}
          </Typography>

          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <Button
              variant="outlined"
              startIcon={<UploadFile />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {t("dialogs.import.chooseFile")}
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {file.name} ({Math.round(file.size / 1024)} KB)
              </Typography>
            )}
          </Box>

          <TextField
            label={t("dialogs.import.graphUriLabel")}
            value={graphUri}
            onChange={(e) => setGraphUri(e.target.value)}
            placeholder={DEFAULT_GRAPH_URI}
            helperText={t("dialogs.import.graphUriHelper")}
            disabled={importing}
            fullWidth
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importing}>
          {t("buttons.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!file || importing}
          startIcon={importing ? <CircularProgress size={16} /> : undefined}
        >
          {importing ? t("dialogs.import.importing") : t("dialogs.import.importButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(ImportDialog);
