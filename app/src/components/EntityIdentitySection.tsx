import React from "react";
import { Box, Typography, TextField, Chip, IconButton, Tooltip, Button } from "@mui/material";
import { AutoAwesome, ContentCopy, Edit, Lock } from "@mui/icons-material";
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
  /** An identifier must be entered before a new entity can be saved. */
  requireIdentifier?: boolean;
  /** Fills the field with a generated identifier (new entities only). */
  onGenerateUri?: () => void;
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
  requireIdentifier = false,
  onGenerateUri,
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
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1, minHeight: 40 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
          {t("common:labels.identifier", { ns: "common" })}
        </Typography>
        {/* One control in both states — a saved entity gets the same field,
            read-only — so the row does not move when an entity is opened. */}
        <TextField
          sx={{ flex: "1 1 260px" }}
          size="small"
          value={entityUri ?? customEntityUri}
          onChange={(event) => onCustomEntityUriChange(event.target.value)}
          disabled={!entityUri && !isEditing}
          error={uriError}
          helperText={uriError ? t("messages.invalidUri") : undefined}
          placeholder={
            requireIdentifier
              ? t("placeholders.enterOrGenerateUri")
              : t("placeholders.enterUri")
          }
          slotProps={{
            htmlInput: {
              "aria-label": t("common:labels.identifier", { ns: "common" }),
              readOnly: !!entityUri,
            },
            input: {
              readOnly: !!entityUri,
              startAdornment: entityUri ? (
                <Lock sx={{ fontSize: "0.9rem", color: "text.disabled", mr: 0.75 }} />
              ) : undefined,
              endAdornment: entityUri ? (
                <Tooltip title={t("tooltips.copyUri")}>
                  <IconButton
                    size="small"
                    edge="end"
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
              ) : undefined,
              // Same type in both states: a URI is technical either way, and
              // matching the font keeps the field exactly the same height
              // whether it is being entered or displayed.
              sx: {
                fontFamily: "monospace",
                fontSize: "0.8rem",
                ...(entityUri && {
                  backgroundColor: "action.hover",
                  color: "text.secondary",
                }),
              },
            },
          }}
        />
        {/* Not every entity has a known URI, and one must be entered when the
            style requires it — so it can be generated here rather than
            invented by hand. */}
        {!entityUri && isEditing && onGenerateUri && (
          <Button size="small" startIcon={<AutoAwesome />} onClick={onGenerateUri}>
            {t("common:buttons.generate", { ns: "common" })}
          </Button>
        )}
      </Box>
      )}

      {showLabels && (
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minHeight: 40 }}>
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
