import React, { useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import { Close, ContentCopy, Download } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { extractUriFragment } from "../utils/labelUtils";

interface TurtleExportDialogProps {
  open: boolean;
  onClose: () => void;
  turtle: string | null;
  isLoading: boolean;
  error: Error | null;
  entityUri: string | null;
  /** Optional override for the dialog title; defaults to single-entity title. */
  title?: string;
  /** Optional override for the downloaded filename stem (without `.ttl`). */
  filenameStem?: string;
}

const TurtleExportDialog: React.FC<TurtleExportDialogProps> = ({
  open,
  onClose,
  turtle,
  isLoading,
  error,
  entityUri,
  title,
  filenameStem,
}) => {
  const { t } = useTranslation(["entityEditor", "common"]);
  const { enqueueSnackbar } = useSnackbar();

  const handleCopy = useCallback(() => {
    if (!turtle) return;
    navigator.clipboard.writeText(turtle).then(
      () => enqueueSnackbar(t("entityEditor:dialogs.turtleExport.copied"), { variant: "success", autoHideDuration: 2000 }),
      () => enqueueSnackbar(t("entityEditor:dialogs.turtleExport.copyFailed"), { variant: "error" }),
    );
  }, [turtle, enqueueSnackbar, t]);

  const handleDownload = useCallback(() => {
    if (!turtle) return;
    const sanitize = (s: string) => s.replace(/[/\\:*?"<>|]/g, "_");
    let stem = filenameStem ? sanitize(filenameStem) : "";
    if (!stem && entityUri) {
      stem = sanitize(extractUriFragment(entityUri));
    }
    const filename = `${stem || "entity"}.ttl`;
    const blob = new Blob([turtle], { type: "text/turtle;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [turtle, entityUri, filenameStem]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="turtle-export-dialog-title"
    >
      <DialogTitle
        id="turtle-export-dialog-title"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        {title ?? t("entityEditor:dialogs.turtleExport.title")}
        <IconButton onClick={onClose} size="small" aria-label={t("common:buttons.cancel")}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error">
            {t("entityEditor:dialogs.turtleExport.errorMessage", { message: error.message })}
          </Alert>
        )}

        {!isLoading && !error && turtle && (
          <Box
            component="pre"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              whiteSpace: "pre",
              overflowX: "auto",
              m: 0,
              p: 1,
              backgroundColor: "action.hover",
              borderRadius: 1,
            }}
          >
            {turtle}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleDownload}
          variant="contained"
          startIcon={<Download />}
          disabled={!turtle || isLoading}
        >
          {t("entityEditor:dialogs.turtleExport.downloadButton")}
        </Button>
        <Button
          onClick={handleCopy}
          variant="outlined"
          startIcon={<ContentCopy />}
          disabled={!turtle || isLoading}
        >
          {t("entityEditor:dialogs.turtleExport.copyButton")}
        </Button>
        <Button onClick={onClose}>
          {t("common:buttons.cancel")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(TurtleExportDialog);
