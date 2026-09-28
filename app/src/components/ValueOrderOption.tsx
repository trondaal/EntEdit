import React, { useId } from "react";
import { Checkbox, FormControlLabel, FormHelperText, Box } from "@mui/material";
import { useTranslation } from "react-i18next";

interface ValueOrderOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Checkbox for including `entedit:valueOrder` annotations in a Turtle export.
 * Off by default: the annotation syntax is Turtle-star/Turtle 1.2, which
 * GraphDB reads but standard Turtle 1.1 tools do not.
 */
const ValueOrderOption: React.FC<ValueOrderOptionProps> = ({ checked, onChange }) => {
  const { t } = useTranslation("entityEditor");
  const helpId = useId();
  return (
    <Box sx={{ mb: 1.5 }}>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            slotProps={{ input: { "aria-describedby": helpId } }}
          />
        }
        label={t("dialogs.turtleExport.valueOrderOption")}
      />
      <FormHelperText id={helpId} sx={{ mt: -0.5, ml: 4 }}>
        {t("dialogs.turtleExport.valueOrderHelp")}
      </FormHelperText>
    </Box>
  );
};

export default ValueOrderOption;
