import React, { useCallback, useMemo, useState } from "react";
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
import { extractUriFragment, repositoryFilenamePrefix } from "../utils/labelUtils";
import {
  serializeToTurtle,
  turtleExtension,
  turtleMimeType,
  type PredObjBinding,
} from "../utils/turtleSerializer";
import type { SparqlEndpointConfig } from "../types/sparql";
import ValueOrderOption from "./ValueOrderOption";

interface TurtleExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** The entity's statements, serialized here so the value-order option needs no refetch */
  bindings: PredObjBinding[] | null;
  isLoading: boolean;
  error: Error | null;
  entityUri: string | null;
  /** Used to prefix the downloaded filename with the repository name. */
  config: SparqlEndpointConfig;
  /** Optional override for the dialog title; defaults to single-entity title. */
  title?: string;
  /** Optional override for the downloaded filename stem (without extension). */
  filenameStem?: string;
}

const TurtleExportDialog: React.FC<TurtleExportDialogProps> = ({
  open,
  onClose,
  bindings,
  isLoading,
  error,
  entityUri,
  config,
  title,
  filenameStem,
}) => {
  const { t } = useTranslation(["entityEditor", "common"]);
  const { enqueueSnackbar } = useSnackbar();
  const [valueOrder, setValueOrder] = useState(false);
  const turtle = useMemo(
    () => (bindings && entityUri ? serializeToTurtle(entityUri, bindings, { valueOrder }) : null),
    [bindings, entityUri, valueOrder],
  );

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
    const filename = `${repositoryFilenamePrefix(config.url)}${stem || "entity"}${turtleExtension(valueOrder)}`;
    const blob = new Blob([turtle], { type: turtleMimeType(valueOrder) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [turtle, entityUri, filenameStem, valueOrder, config.url]);

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
          <ValueOrderOption checked={valueOrder} onChange={setValueOrder} />
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
          {t("entityEditor:dialogs.turtleExport.downloadButton", { extension: turtleExtension(valueOrder) })}
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
