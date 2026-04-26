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
  Tooltip,
  Paper,
  type PaperProps,
} from "@mui/material";
import { Add, Delete, Label, DragIndicator, Save } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../utils/sparqlFragments";

/**
 * Custom draggable Paper for MUI Dialog.
 * Uses mousedown on the handle + document-level mousemove/mouseup so that
 * pointer capture never interferes with text selection in the main window.
 */
const DraggablePaper = React.forwardRef<HTMLDivElement, PaperProps>(
  function DraggablePaper(props, ref) {
    const paperRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: 0, y: 0 });

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

      const onMouseDown = (e: MouseEvent) => {
        // Only drag on the handle itself, not on interactive children
        if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;

        const startX = e.clientX - posRef.current.x;
        const startY = e.clientY - posRef.current.y;

        const onMouseMove = (ev: MouseEvent) => {
          posRef.current = {
            x: ev.clientX - startX,
            y: ev.clientY - startY,
          };
          paper.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

        // Prevent text selection only during the drag gesture
        e.preventDefault();
      };

      handle.addEventListener("mousedown", onMouseDown);
      return () => handle.removeEventListener("mousedown", onMouseDown);
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
  const [error, setError] = useState<string | null>(null);
  const newRowRef = useRef<HTMLInputElement>(null);

  // Only sync from parent when the dialog opens, not on every parent re-render,
  // to avoid discarding in-progress label edits
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- seed editable labels when dialog opens
  useEffect(() => {
    if (open) {
      // Start with one empty row if there are no labels, so the user
      // can type immediately without clicking Add first.
      const startLabels = initialLabels.length > 0
        ? initialLabels
        : [{ id: `new-${Date.now()}`, value: "", language: "" }];
      setLabels(startLabels);
      setError(null);
    }
  }, [open]);

  const handleAddLabel = () => {
    // eslint-disable-next-line react-hooks/purity -- event handler, not render
    const newId = `new-${Date.now()}`;
    setLabels((prev) => [...prev, { id: newId, value: "", language: "" }]);
    setError(null);
    // Focus the new row's text field after render
    setTimeout(() => newRowRef.current?.focus(), 0);
  };

  const handleValueChange = (id: string, value: string) => {
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, value } : l)));
    setError(null);
  };

  const handleLanguageChange = (id: string, language: string) => {
    setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, language } : l)));
    setError(null);
  };

  const handleDeleteLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === labels.length - 1) {
        // Last row: add a new one
        handleAddLabel();
      }
    }
  };

  const handleApply = () => {
    // Strip empty labels
    const nonEmpty = labels.filter((l) => l.value.trim());

    // Check for duplicate language tags
    const seen = new Set<string>();
    for (const label of nonEmpty) {
      if (seen.has(label.language)) {
        setError(
          label.language
            ? t("labelManager.errors.duplicateLanguage", { lang: label.language })
            : t("labelManager.errors.duplicateNoLanguage"),
        );
        return;
      }
      seen.add(label.language);
    }

    onSave(nonEmpty);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperComponent={DraggablePaper}
      aria-labelledby="label-manager-dialog-title"
      hideBackdrop
      disableScrollLock
      disableEnforceFocus
      disableAutoFocus
      disableRestoreFocus
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

        {labels.length === 0 ? (
          <Box sx={{ color: "text.disabled", textAlign: "center", py: 3 }}>
            {t("labelManager.empty")}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {labels.map((label, index) => (
              <Box
                key={label.id}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <TextField
                  size="small"
                  fullWidth
                  value={label.value}
                  onChange={(e) => handleValueChange(label.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  placeholder={t("labelManager.placeholders.labelValue")}
                  inputRef={index === labels.length - 1 ? newRowRef : undefined}
                />
                <Select
                  size="small"
                  value={label.language}
                  onChange={(e) => handleLanguageChange(label.id, e.target.value)}
                  sx={{ minWidth: 80 }}
                >
                  <MenuItem value=""><em>—</em></MenuItem>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <MenuItem key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
                <Tooltip title={t("labelManager.tooltips.delete")}>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteLabel(label.id)}
                    color="error"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleAddLabel}
        >
          {t("common:buttons.add")}
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose}>
            {t("common:buttons.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
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
