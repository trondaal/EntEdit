import React from "react";
import {
  Box,
  Checkbox,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  applyPreset,
  styleOf,
  type CatalogingPreferences,
  type CatalogingStyle,
} from "../utils/catalogingStyle";

interface CatalogingStyleSettingsProps {
  preferences: CatalogingPreferences;
  onChange: (preferences: CatalogingPreferences) => void;
  /** Omit the heading where the surrounding step already carries it. */
  hideHeading?: boolean;
}

/**
 * Chooses how prominent RDF identity is in the editor: the two presets set
 * everything at once, and the grid below them tunes identifier and label
 * separately. Shared by the setup wizard and the settings dialog.
 */
const CatalogingStyleSettings: React.FC<CatalogingStyleSettingsProps> = ({
  preferences,
  onChange,
  hideHeading = false,
}) => {
  const { t } = useTranslation();
  const style = styleOf(preferences);

  const toggle = (key: keyof CatalogingPreferences) => (checked: boolean) =>
    onChange({ ...preferences, [key]: checked });

  const rows: Array<{
    label: string;
    show: keyof CatalogingPreferences;
    require: keyof CatalogingPreferences;
  }> = [
    {
      label: t("catalogingStyle.identifierRow"),
      show: "showIdentifier",
      require: "requireIdentifier",
    },
    { label: t("catalogingStyle.labelsRow"), show: "showLabels", require: "requireLabel" },
  ];

  return (
    <Box>
      {!hideHeading && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t("catalogingStyle.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("catalogingStyle.description")}
          </Typography>
        </>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={style === "custom" ? null : style}
        onChange={(_, next: CatalogingStyle | null) =>
          next && onChange(applyPreset(next, preferences))
        }
        sx={{ mb: 2 }}
      >
        <ToggleButton value="classic">{t("catalogingStyle.classic")}</ToggleButton>
        <ToggleButton value="semantic">{t("catalogingStyle.semantic")}</ToggleButton>
      </ToggleButtonGroup>
      {style === "custom" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("catalogingStyle.custom")}
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "minmax(90px, auto) 1fr 1fr" },
          alignItems: "center",
          columnGap: 2,
        }}
      >
        <Box sx={{ display: { xs: "none", sm: "block" } }} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          {t("catalogingStyle.showColumn")}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          {t("catalogingStyle.requireColumn")}
        </Typography>

        {rows.map((row) => (
          <React.Fragment key={row.show}>
            <Typography variant="body2" sx={{ mt: { xs: 1.5, sm: 0 } }}>
              {row.label}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences[row.show]}
                  onChange={(event) => toggle(row.show)(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2" sx={{ display: { sm: "none" } }}>
                  {t("catalogingStyle.showColumn")}
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences[row.require]}
                  onChange={(event) => toggle(row.require)(event.target.checked)}
                />
              }
              label={
                <Typography variant="body2" sx={{ display: { sm: "none" } }}>
                  {t("catalogingStyle.requireColumn")}
                </Typography>
              }
            />
          </React.Fragment>
        ))}
      </Box>
      {/* Not part of either style: a display preference of its own. */}
      <FormControlLabel
        sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider", width: "100%" }}
        control={
          <Checkbox
            checked={preferences.showInferredMarks}
            onChange={(event) => toggle("showInferredMarks")(event.target.checked)}
          />
        }
        label={
          <Typography variant="body2">{t("catalogingStyle.showInferredMarks")}</Typography>
        }
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {t("catalogingStyle.hiddenNote")}
      </Typography>
    </Box>
  );
};

export default CatalogingStyleSettings;
