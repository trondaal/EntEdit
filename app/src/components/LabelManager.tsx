import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Paper,
  type PaperProps,
} from "@mui/material";
import { Add, Delete, Edit, Save, Cancel, Label, DragIndicator } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../utils/sparqlFragments";

/**
 * Custom draggable Paper for MUI Dialog.
 * Uses native pointer events — no external library needed, React 19 safe.
 */
const DraggablePaper = React.forwardRef<HTMLDivElement, PaperProps>(
  function DraggablePaper(props, ref) {
    const paperRef = useRef<HTMLDivElement>(null);
    const offsetRef = useRef({ x: 0, y: 0 });
    const posRef = useRef({ x: 0, y: 0 });
    const dragging = useRef(false);

    // Merge forwarded ref with local ref
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        (paperRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    useEffect(() => {
      const paper = paperRef.current;
      if (!paper) return;

      const handle = paper.querySelector<HTMLElement>("[data-drag-handle]");
      if (!handle) return;

      const onPointerDown = (e: PointerEvent) => {
        // Only drag on the handle itself, not on buttons/inputs inside it
        if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
        dragging.current = true;
        offsetRef.current = {
          x: e.clientX - posRef.current.x,
          y: e.clientY - posRef.current.y,
        };
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging.current) return;
        posRef.current = {
          x: e.clientX - offsetRef.current.x,
          y: e.clientY - offsetRef.current.y,
        };
        paper.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
      };

      const onPointerUp = () => {
        dragging.current = false;
      };

      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);

      return () => {
        handle.removeEventListener("pointerdown", onPointerDown);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
      };
    }, []);

    return <Paper ref={setRef} {...props} />;
  },
);

interface LabelEntry {
  id: string;
  value: string;
  language: string;
}

interface LabelManagerProps {
  open: boolean;
  onClose: () => void;
  onSave: (labels: LabelEntry[]) => void;
  initialLabels: LabelEntry[];
}

const LabelManager: React.FC<LabelManagerProps> = ({
  open,
  onClose,
  onSave,
  initialLabels,
}) => {
  const { t } = useTranslation("entityEditor");
  const [labels, setLabels] = useState<LabelEntry[]>(initialLabels);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [tempLanguage, setTempLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabels(initialLabels);
  }, [initialLabels]);

  const handleAddLabel = () => {
    const newId = `new-${Date.now()}`;
    setLabels((prev) => [...prev, { id: newId, value: "", language: "" }]);
    setEditingId(newId);
    setTempValue("");
    setTempLanguage("");
    setError(null);
  };

  const handleEditLabel = (label: LabelEntry) => {
    setEditingId(label.id);
    setTempValue(label.value);
    setTempLanguage(label.language);
    setError(null);
  };

  const handleSaveRow = () => {
    if (!tempValue.trim()) {
      setError(t("labelManager.errors.emptyValue"));
      return;
    }
    const duplicate = labels.find(
      (l) => l.id !== editingId && l.language === tempLanguage
    );
    if (duplicate) {
      setError(
        tempLanguage
          ? t("labelManager.errors.duplicateLanguage", { lang: tempLanguage })
          : t("labelManager.errors.duplicateNoLanguage")
      );
      return;
    }
    setLabels((prev) =>
      prev.map((l) =>
        l.id === editingId
          ? { ...l, value: tempValue.trim(), language: tempLanguage }
          : l
      )
    );
    setEditingId(null);
    setError(null);
  };

  const handleCancelRow = () => {
    if (editingId?.startsWith("new-")) {
      setLabels((prev) => prev.filter((l) => l.id !== editingId));
    }
    setEditingId(null);
    setTempValue("");
    setTempLanguage("");
    setError(null);
  };

  const handleDeleteLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setError(null);
    }
  };

  const handleApply = () => {
    if (editingId) {
      setError(t("labelManager.errors.unsavedEdit"));
      return;
    }
    onSave(labels);
  };

  const handleClose = () => {
    if (editingId) {
      setError(t("labelManager.errors.unsavedEdit"));
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperComponent={DraggablePaper}
      aria-labelledby="label-manager-dialog-title"
      hideBackdrop
      disableScrollLock
      sx={{
        // Allow interaction with content behind the dialog
        pointerEvents: "none",
        "& .MuiDialog-container": { pointerEvents: "none" },
        "& .MuiPaper-root": { pointerEvents: "auto" },
      }}
    >
      <DialogTitle
        data-drag-handle
        id="label-manager-dialog-title"
        sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, cursor: "move", userSelect: "none" }}
      >
        <DragIndicator fontSize="small" sx={{ color: "text.disabled" }} />
        <Label fontSize="small" />
        {t("labelManager.title")}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("labelManager.columns.label")}</TableCell>
              <TableCell sx={{ width: 110 }}>{t("labelManager.columns.language")}</TableCell>
              <TableCell sx={{ width: 80 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {labels.map((label) =>
              editingId === label.id ? (
                <TableRow key={label.id}>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      autoFocus
                      error={!tempValue.trim()}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveRow()}
                      placeholder={t("labelManager.placeholders.labelValue")}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Select
                      size="small"
                      fullWidth
                      value={tempLanguage}
                      onChange={(e) => setTempLanguage(e.target.value)}
                    >
                      <MenuItem value=""><em>—</em></MenuItem>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <MenuItem key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <Tooltip title={t("labelManager.tooltips.save")}>
                      <IconButton size="small" onClick={handleSaveRow} color="primary">
                        <Save fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("labelManager.tooltips.cancel")}>
                      <IconButton size="small" onClick={handleCancelRow}>
                        <Cancel fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={label.id} hover>
                  <TableCell>{label.value}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                    {label.language ? label.language.toUpperCase() : "—"}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={t("labelManager.tooltips.edit")}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleEditLabel(label)}
                          disabled={!!editingId}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t("labelManager.tooltips.delete")}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteLabel(label.id)}
                          disabled={!!editingId}
                          color="error"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            )}
            {labels.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ color: "text.disabled", textAlign: "center", py: 2 }}>
                  {t("labelManager.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleAddLabel}
          disabled={!!editingId}
        >
          {t("common:buttons.add")}
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={handleClose} disabled={!!editingId}>
            {t("common:buttons.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={!!editingId}
            startIcon={<Save />}
          >
            {t("common:buttons.apply")}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default LabelManager;
