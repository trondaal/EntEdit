import React from "react";
import { Box, Typography, TextField, Chip, IconButton, Tooltip, Button } from "@mui/material";
import { ContentCopy, Edit, Lock } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

interface EntityIdentitySectionProps {
  /** URI of a saved entity; null while creating a new one. */
  entityUri: string | null;
  /** URI typed by the user for a new entity. */
  customEntityUri: string;
  onCustomEntityUriChange: (value: string) => void;
  uriError: boolean;
  labels: Array<{ id: string; value: string; language: string }>;
  isEditing: boolean;
  onEditLabels: () => void;
  /** Cataloguing style: which rows belong on the form. */
  showIdentifier: boolean;
  showLabels: boolean;
  /** Rendered inside a dialog, so the section heading is redundant. */
  hideHeading?: boolean;
}

/**
 * Identifier and labels at the top of the editor.
 *
 * Both used to be reachable only through the header's overflow menu, which
 * hid the two things a cataloguer decides first and gave no feedback that an
 * identifier had been entered at all.
 */
const EntityIdentitySection: React.FC<EntityIdentitySectionProps> = ({
  entityUri,
  customEntityUri,
  onCustomEntityUriChange,
  uriError,
  labels,
  isEditing,
  onEditLabels,
  showIdentifier,
  showLabels,
  hideHeading = false,
}) => {
  const { t } = useTranslation("entityEditor");
  const { enqueueSnackbar } = useSnackbar();

  const labelsWithValue = labels.filter((label) => label.value.trim());

  // In the classic cataloguing style neither row is shown and the section
  // disappears; both stay reachable from the editor's ⋮ menu.
  if (!showIdentifier && !showLabels) return null;

  return (
    <Box sx={{ mb: 2.5 }}>
      {!hideHeading && (
        <Typography variant="subtitle1" sx={{ color: "text.primary", mb: 1.5 }}>
          {t("sections.identity")}
        </Typography>
      )}

      {showIdentifier && (
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
          {t("common:labels.identifier", { ns: "common" })}
        </Typography>
        {entityUri ? (
          <Box
            sx={{
              flex: "1 1 260px",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.25,
              py: 0.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              backgroundColor: "action.hover",
            }}
          >
            <Lock sx={{ fontSize: "0.9rem", color: "text.disabled", flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                color: "text.secondary",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                wordBreak: "break-all",
              }}
            >
              {entityUri}
            </Typography>
            <Tooltip title={t("tooltips.copyUri")}>
              <IconButton
                size="small"
                sx={{ p: 0.5 }}
                aria-label={t("tooltips.copyUri")}
                onClick={() =>
                  navigator.clipboard.writeText(entityUri).then(
                    () =>
                      enqueueSnackbar(t("messages.uriCopied"), {
                        variant: "success",
                        autoHideDuration: 2000,
                      }),
                    () => enqueueSnackbar(t("messages.copyFailed"), { variant: "error" }),
                  )
                }
              >
                <ContentCopy sx={{ fontSize: "0.9rem" }} />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <TextField
            sx={{ flex: "1 1 260px" }}
            size="small"
            value={customEntityUri}
            onChange={(event) => onCustomEntityUriChange(event.target.value)}
            disabled={!isEditing}
            error={uriError}
            placeholder={t("placeholders.enterUri")}
            helperText={uriError ? t("placeholders.enterUri") : t("messages.uriWillBeGenerated")}
            slotProps={{
              htmlInput: { "aria-label": t("common:labels.identifier", { ns: "common" }) },
            }}
          />
        )}
      </Box>
      )}

      {showLabels && (
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
          {t("common:labels.labels", { ns: "common" })}
        </Typography>
        {labelsWithValue.length > 0 ? (
          labelsWithValue.map((label) => (
            <Chip
              key={label.id}
              size="small"
              label={
                label.language ? `${label.value} (${label.language.toUpperCase()})` : label.value
              }
              variant="outlined"
            />
          ))
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
            {t("messages.noLabel")}
          </Typography>
        )}
        {isEditing && (
          <Button size="small" startIcon={<Edit />} onClick={onEditLabels}>
            {t("common:buttons.editLabels", { ns: "common" })}
          </Button>
        )}
      </Box>
      )}
    </Box>
  );
};

export default React.memo(EntityIdentitySection);
