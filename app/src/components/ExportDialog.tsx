import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
} from "@mui/material";
import { Close, ContentCopy, Download } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { formatLabel, extractUriFragment } from "../utils/labelUtils";
import { useRdfClasses } from "../hooks/useSchemaQueries";
import { useAllEntitiesTurtleExportQuery } from "../hooks/useAllEntitiesTurtleExportQuery";

const LARGE_EXPORT_THRESHOLD = 1000;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  config,
  selectedLanguage,
}) => {
  const { t } = useTranslation(["entityEditor", "common"]);

  // Fetch classes internally
  const { data: classes } = useRdfClasses(config, selectedLanguage);
  const { enqueueSnackbar } = useSnackbar();

  // Track which classes are selected (by URI)
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  // Whether we're showing the result or the selection
  const [showResult, setShowResult] = useState(false);
  // Large export confirmation
  const [showLargeWarning, setShowLargeWarning] = useState(false);

  // Fetch entity counts per class
  const { data: classCounts } = useQuery({
    queryKey: ["class-counts", config.url, selectedLanguage],
    queryFn: async () => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        SELECT ?class (COUNT(DISTINCT ?entity) AS ?count)
        WHERE {
          ?entity a ?class .
          ?class a owl:Class .
          ?class entedit:status "class" .
        }
        GROUP BY ?class
      `;
      const response = await client.query(query);
      const counts = new Map<string, number>();
      for (const b of response.results.bindings) {
        counts.set(b.class.value, parseInt(b.count.value, 10));
      }
      return counts;
    },
    enabled: open && !!config.url,
  });

  // Select all classes by default when dialog opens
  useEffect(() => {
    if (open && classes) {
      setSelectedClasses(new Set(classes.map((c) => c.uri)));
      setShowResult(false);
      setShowLargeWarning(false);
    }
  }, [open, classes]);

  const classUrisArray = useMemo(
    () => Array.from(selectedClasses),
    [selectedClasses],
  );

  const allSelected = classes ? selectedClasses.size === classes.length : false;

  const {
    turtle,
    isLoading: turtleLoading,
    error: turtleError,
    refetch: fetchTurtle,
  } = useAllEntitiesTurtleExportQuery(config, classUrisArray);

  const totalSelectedCount = useMemo(() => {
    if (!classCounts) return 0;
    let total = 0;
    for (const uri of selectedClasses) {
      total += classCounts.get(uri) ?? 0;
    }
    return total;
  }, [classCounts, selectedClasses]);

  const handleToggleClass = useCallback((uri: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (!classes) return;
    if (allSelected) {
      setSelectedClasses(new Set());
    } else {
      setSelectedClasses(new Set(classes.map((c) => c.uri)));
    }
  }, [classes, allSelected]);

  const startExport = useCallback(() => {
    setShowResult(true);
    setShowLargeWarning(false);
    void fetchTurtle();
  }, [fetchTurtle]);

  const handleExport = useCallback(() => {
    if (totalSelectedCount > LARGE_EXPORT_THRESHOLD) {
      setShowLargeWarning(true);
    } else {
      startExport();
    }
  }, [totalSelectedCount, startExport]);

  const handleCopy = useCallback(() => {
    if (!turtle) return;
    navigator.clipboard.writeText(turtle).then(
      () => enqueueSnackbar(t("entityEditor:dialogs.turtleExport.copied"), { variant: "success", autoHideDuration: 2000 }),
      () => enqueueSnackbar(t("entityEditor:dialogs.turtleExport.copyFailed"), { variant: "error" }),
    );
  }, [turtle, enqueueSnackbar, t]);

  const handleDownload = useCallback(() => {
    if (!turtle) return;
    const stem = allSelected
      ? "all-entities"
      : classUrisArray.map((u) => extractUriFragment(u)).join("-");
    const filename = `${stem}.ttl`;
    const blob = new Blob([turtle], { type: "text/turtle;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [turtle, allSelected, classUrisArray]);

  const handleClose = useCallback(() => {
    setShowResult(false);
    setShowLargeWarning(false);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setShowResult(false);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={showResult ? "md" : "sm"}
      aria-labelledby="export-dialog-title"
    >
      <DialogTitle
        id="export-dialog-title"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        {t("entityEditor:dialogs.export.title")}
        <IconButton onClick={handleClose} size="small" aria-label={t("common:buttons.cancel")}>
          <Close />
        </IconButton>
      </DialogTitle>

      {!showResult ? (
        <>
          <DialogContent dividers>
            {showLargeWarning && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t("entityEditor:dialogs.export.largeWarning", { count: totalSelectedCount })}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("entityEditor:dialogs.export.description")}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={selectedClasses.size > 0 && !allSelected}
                  onChange={handleToggleAll}
                />
              }
              label={
                <Typography variant="body2" fontWeight={600}>
                  {t("entityEditor:dialogs.export.selectAll")}
                </Typography>
              }
            />
            <Divider sx={{ mb: 0.5 }} />
            {classes?.map((rdfClass) => {
              const count = classCounts?.get(rdfClass.uri) ?? 0;
              return (
                <FormControlLabel
                  key={rdfClass.uri}
                  control={
                    <Checkbox
                      checked={selectedClasses.has(rdfClass.uri)}
                      onChange={() => handleToggleClass(rdfClass.uri)}
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2">
                        {formatLabel(rdfClass.label, rdfClass.uri)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ({count})
                      </Typography>
                    </Box>
                  }
                  sx={{ display: "flex", ml: 2 }}
                />
              );
            })}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>
              {t("common:buttons.cancel")}
            </Button>
            {showLargeWarning ? (
              <Button
                variant="contained"
                onClick={startExport}
              >
                {t("entityEditor:dialogs.export.exportAnyway")}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleExport}
                disabled={selectedClasses.size === 0}
              >
                {t("entityEditor:dialogs.export.exportButton", { count: totalSelectedCount })}
              </Button>
            )}
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent dividers>
            {turtleLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {turtleError && (
              <Alert severity="error">
                {t("entityEditor:dialogs.turtleExport.errorMessage", { message: turtleError.message })}
              </Alert>
            )}

            {!turtleLoading && !turtleError && turtle && (
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
            <Button onClick={handleBack}>
              {t("common:buttons.back")}
            </Button>
            <Button
              onClick={handleDownload}
              variant="contained"
              startIcon={<Download />}
              disabled={!turtle || turtleLoading}
            >
              {t("entityEditor:dialogs.turtleExport.downloadButton")}
            </Button>
            <Button
              onClick={handleCopy}
              variant="outlined"
              startIcon={<ContentCopy />}
              disabled={!turtle || turtleLoading}
            >
              {t("entityEditor:dialogs.turtleExport.copyButton")}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default React.memo(ExportDialog);
