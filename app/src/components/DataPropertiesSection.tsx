import React from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { RdfProperty } from "../types/sparql";

interface DataPropertiesSectionProps {
  entityData: Record<string, string[]>;
  properties: RdfProperty[];
  isEditing: boolean;
  classUri: string;
  selectedProperty: string;
  onPropertySelect: (propertyUri: string) => void;
  onUpdateValue: (property: string, index: number, value: string) => void;
  onRemoveValue: (property: string, index: number) => void;
  getPropertyLabel: (propertyUri: string) => string;
}

const DataPropertiesSection: React.FC<DataPropertiesSectionProps> = ({
  entityData,
  properties,
  isEditing,
  classUri,
  selectedProperty,
  onPropertySelect,
  onUpdateValue,
  onRemoveValue,
  getPropertyLabel,
}) => {
  const { t } = useTranslation("entityEditor");

  // Get available properties (excluding rdfs:label)
  const availableProperties = properties.filter(
    (property) => property.uri !== "http://www.w3.org/2000/01/rdf-schema#label",
  );

  // Get properties that have values, using the order from the already-sorted properties array
  const dataPropertiesWithValues = properties
    .filter((p) => p.uri !== "http://www.w3.org/2000/01/rdf-schema#label")
    .filter((p) => entityData[p.uri] && entityData[p.uri].length > 0)
    .map((p) => p.uri);

  return (
    <>
      {(isEditing || dataPropertiesWithValues.length > 0) && (
        <>
          <Divider sx={{ my: 1.5 }} />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Typography variant="subtitle1">
              {t("sections.textMetadata")}
            </Typography>

            {isEditing && availableProperties.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t("common:labels.addTextValue", { ns: "common" })}</InputLabel>
                <Select
                  value={selectedProperty}
                  label={t("common:labels.addTextValue", { ns: "common" })}
                  onChange={(e) => onPropertySelect(e.target.value)}
                  disabled={!classUri}
                >
                  {availableProperties.map((property) => (
                    <MenuItem key={property.uri} value={property.uri}>
                      {getPropertyLabel(property.uri)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </>
      )}

      {dataPropertiesWithValues.map((propertyUri) => (
        <Box key={propertyUri} sx={{ mb: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 0.5 }}
          >
            {getPropertyLabel(propertyUri)}
          </Typography>
          {entityData[propertyUri].map((value, index) => (
            <Box
              key={`${propertyUri}-${index}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 0.5,
              }}
            >
              <TextField
                fullWidth
                value={value}
                onChange={(e) =>
                  onUpdateValue(propertyUri, index, e.target.value)
                }
                disabled={!isEditing || !classUri}
                size="small"
                placeholder={t("placeholders.enterValue", { propertyName: getPropertyLabel(propertyUri) })}
                sx={{
                  "& .MuiInputBase-input": { fontSize: "0.875rem", py: 0.75 },
                  "& .MuiInputLabel-outlined": { fontSize: "0.875rem" },
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: "rgba(0, 0, 0, 0.75)",
                  },
                }}
              />
              {isEditing && (
                <IconButton
                  size="small"
                  onClick={() => onRemoveValue(propertyUri, index)}
                  color="error"
                  sx={{ p: 0.5 }}
                  aria-label={t("common:buttons.remove", { ns: "common" })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      ))}
    </>
  );
};

export default React.memo(DataPropertiesSection);
