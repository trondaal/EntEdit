import React, { useState, useEffect } from "react";
import {
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { FiberManualRecord, Stop, Download } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useLogging } from "../hooks/useLogging";
import type { LogSession } from "../types/logging";

interface LoggingControlsProps {
  endpointUrl: string;
  language: string;
}

const LoggingControls: React.FC<LoggingControlsProps> = ({
  endpointUrl,
  language,
}) => {
  const { t } = useTranslation();
  const {
    isRecording,
    startSession,
    stopSession,
    hasOrphanedSession,
    recoverOrphanedSession,
    discardOrphanedSession,
  } = useLogging();

  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<LogSession | null>(null);
  const [studentId, setStudentId] = useState("");
  const [orphanDialogOpen, setOrphanDialogOpen] = useState(false);

  // Check for orphaned session on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time check
  useEffect(() => {
    if (hasOrphanedSession()) {
      setOrphanDialogOpen(true);
    }
  }, [hasOrphanedSession]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartClick = () => {
    setConsentChecked(false);
    setConsentOpen(true);
  };

  const handleConsentAgree = () => {
    setConsentOpen(false);
    startSession(endpointUrl, language);
  };

  const handleStopClick = () => {
    const session = stopSession();
    if (session) {
      setCompletedSession(session);
      setSubmitOpen(true);
    }
  };

  const handleDownload = () => {
    if (!completedSession) return;

    const sessionWithId = studentId.trim()
      ? { ...completedSession, studentId: studentId.trim() }
      : completedSession;

    const json = JSON.stringify(sessionWithId, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `entedit-log-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSubmitOpen(false);
    setCompletedSession(null);
    setStudentId("");
  };

  const handleSubmitClose = () => {
    setSubmitOpen(false);
    setCompletedSession(null);
    setStudentId("");
  };

  const handleOrphanRecover = () => {
    const session = recoverOrphanedSession();
    if (session) {
      setCompletedSession(session);
      setSubmitOpen(true);
    }
    setOrphanDialogOpen(false);
  };

  const handleOrphanDiscard = () => {
    discardOrphanedSession();
    setOrphanDialogOpen(false);
  };

  return (
    <>
      {/* Recording button / indicator */}
      {isRecording ? (
        <Chip
          icon={<Stop />}
          label={t("logging.recording")}
          onClick={handleStopClick}
          variant="outlined"
          sx={{
            backgroundColor: "rgba(192, 57, 43, 0.12)",
            color: "#fff",
            borderColor: "rgba(192, 57, 43, 0.4)",
            "& .MuiChip-icon": {
              color: "#ff6b6b",
              animation: "pulse-dot 3s ease-in-out infinite",
            },
            "&:hover": {
              backgroundColor: "rgba(192, 57, 43, 0.25)",
            },
            "@keyframes pulse-dot": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 },
            },
          }}
          aria-label={t("logging.stopRecording")}
        />
      ) : (
        <Chip
          icon={<FiberManualRecord sx={{ fontSize: 14 }} />}
          label={t("logging.record")}
          onClick={handleStartClick}
          variant="outlined"
          sx={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            color: "rgba(255, 255, 255, 0.85)",
            borderColor: "rgba(255, 255, 255, 0.20)",
            "& .MuiChip-icon": { color: "rgba(255, 255, 255, 0.6)" },
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.18)",
            },
          }}
          aria-label={t("logging.startRecording")}
        />
      )}

      {/* Consent Dialog */}
      <Dialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("logging.consentTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("logging.consentDescription")}
          </DialogContentText>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
            {t("logging.whatIsRecorded")}
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 2, color: "text.secondary" }}>
            <li>{t("logging.recordedItem1")}</li>
            <li>{t("logging.recordedItem2")}</li>
            <li>{t("logging.recordedItem3")}</li>
            <li>{t("logging.recordedItem4")}</li>
          </Typography>

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            {t("logging.whatIsNotRecorded")}
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 2, color: "text.secondary" }}>
            <li>{t("logging.notRecordedItem1")}</li>
            <li>{t("logging.notRecordedItem2")}</li>
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
            }
            label={t("logging.consentCheckbox")}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConsentOpen(false)}>
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={handleConsentAgree}
            variant="contained"
            disabled={!consentChecked}
          >
            {t("logging.startRecording")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Submit / Download Dialog */}
      <Dialog
        open={submitOpen}
        onClose={handleSubmitClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("logging.submitTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("logging.submitDescription")}
          </DialogContentText>

          {completedSession && (
            <Box sx={{ mb: 3, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t("logging.eventCount", { count: completedSession.events.length })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("logging.sessionDuration", {
                  duration: formatDuration(
                    Math.floor(
                      (new Date(completedSession.endedAt!).getTime() -
                        new Date(completedSession.startedAt).getTime()) /
                        1000,
                    ),
                  ),
                })}
              </Typography>
            </Box>
          )}

          <TextField
            label={t("logging.studentIdLabel")}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            fullWidth
            size="small"
            helperText={t("logging.studentIdHelper")}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmitClose}>
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={handleDownload}
            variant="contained"
            startIcon={<Download />}
          >
            {t("logging.downloadJson")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Orphaned Session Recovery Dialog */}
      <Dialog
        open={orphanDialogOpen}
        onClose={handleOrphanDiscard}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("logging.orphanTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("logging.orphanDescription")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOrphanDiscard}>
            {t("logging.orphanDiscard")}
          </Button>
          <Button onClick={handleOrphanRecover} variant="contained">
            {t("logging.orphanRecover")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LoggingControls;
