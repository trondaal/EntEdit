import React, { useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { RdfProperty, OrderedValue } from "../types/sparql";
import OrderableValueList from "./OrderableValueList";
import { languageName, languagesInUse, VALUE_LANGUAGES } from "../utils/languages";

interface DataPropertiesSectionProps {
  entityData: Record<string, OrderedValue[]>;
  /** Show each value's language, and offer a selector while editing. */
  showLanguageTags: boolean;
  onUpdateValueLanguage: (property: string, index: number, language: string) => void;
  properties: RdfProperty[];
  isEditing: boolean;
  showInferredMarks: boolean;
  classUri: string;
  selectedProperty: string;
  onPropertySelect: (propertyUri: string) => void;
  onUpdateValue: (property: string, index: number, value: string) => void;
  onRemoveValue: (property: string, index: number) => void;
  onReorderValues: (property: string, fromIndex: number, toIndex: number) => void;
  getPropertyLabel: (propertyUri: string) => string;
}

const DataPropertiesSection: React.FC<DataPropertiesSectionProps> = ({
  entityData,
  showLanguageTags,
  onUpdateValueLanguage,
  properties,
  isEditing,
  showInferredMarks,
  classUri,
  selectedProperty,
  onPropertySelect,
  onUpdateValue,
  onRemoveValue,
  onReorderValues,
  getPropertyLabel,
}) => {
  const { t, i18n } = useTranslation("entityEditor");

  // Language belongs on names, titles and notes — not on dates, numbering or
  // measurements, which the profile marks with entedit:linguistic false.
  const isLinguistic = useCallback(
    (propertyUri: string) =>
      properties.find((p) => p.uri === propertyUri)?.linguistic !== false,
    [properties],
  );

  // A property whose values differ in language always shows the tags, even
  // when the setting is off: without them the values look like duplicates.
  const ambiguousProperties = useMemo(() => {
    const ambiguous = new Set<string>();
    for (const [property, values] of Object.entries(entityData)) {
      if (languagesInUse(values).size > 1) ambiguous.add(property);
    }
    return ambiguous;
  }, [entityData]);
  // Focus the field the user just added, instead of leaving focus on the
  // "Add" dropdown, which cost an extra tab on every value.
  const focusRef = React.useRef<HTMLInputElement | null>(null);
  const [focusTarget, setFocusTarget] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (focusTarget && focusRef.current) {
      focusRef.current.focus();
      setFocusTarget(null);
    }
  }, [focusTarget]);

  // Get available properties (excluding rdfs:label)
  const availableProperties = useMemo(
    () => properties.filter(
      (property) => property.uri !== "http://www.w3.org/2000/01/rdf-schema#label",
    ),
    [properties],
  );

  // Get properties that have values, using the order from the already-sorted properties array
  const dataPropertiesWithValues = useMemo(
    () => properties
      .filter((p) => p.uri !== "http://www.w3.org/2000/01/rdf-schema#label")
      .filter((p) => entityData[p.uri] && entityData[p.uri].length > 0)
      .map((p) => p.uri),
    [properties, entityData],
  );

  // Generate stable IDs for sortable items per property
  const itemIdsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    dataPropertiesWithValues.forEach((propertyUri) => {
      const values = entityData[propertyUri] || [];
      map[propertyUri] = values.map(
        (v, i) => `${propertyUri}--${i}--${v.order}`,
      );
    });
    return map;
  }, [dataPropertiesWithValues, entityData]);

  return (
    <>
      {(isEditing || dataPropertiesWithValues.length > 0) && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
              // Reserve the height of the "Add" control, which only appears in
              // edit mode, so section headings do not shift when editing starts
              minHeight: 40,
            }}
          >
            <Typography variant="subtitle1" sx={{ color: "text.primary" }}>
              {t("sections.textMetadata")}
            </Typography>

            {isEditing && availableProperties.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>{t("common:labels.addTextValue", { ns: "common" })}</InputLabel>
                <Select
                  value={selectedProperty}
                  label={t("common:labels.addTextValue", { ns: "common" })}
                  onChange={(e) => {
                    onPropertySelect(e.target.value);
                    setFocusTarget(e.target.value);
                  }}
                  disabled={!classUri}
                  inputProps={{ "aria-label": t("common:labels.addTextValue", { ns: "common" }) }}
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
          <OrderableValueList
            propertyUri={propertyUri}
            itemIds={itemIdsMap[propertyUri] || []}
            isEditing={isEditing}
            onReorder={onReorderValues}
          >
            {(index) => (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <TextField
                  fullWidth
                  inputRef={
                    focusTarget === propertyUri &&
                    index === entityData[propertyUri].length - 1
                      ? focusRef
                      : undefined
                  }
                  value={entityData[propertyUri][index].value}
                  onChange={(e) =>
                    onUpdateValue(propertyUri, index, e.target.value)
                  }
                  disabled={
                    !isEditing || !classUri || !!entityData[propertyUri][index].inferred
                  }
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
                {isEditing &&
                ((showLanguageTags && isLinguistic(propertyUri)) ||
                  ambiguousProperties.has(propertyUri)) ? (
                  <FormControl size="small" sx={{ width: 76, flexShrink: 0 }}>
                    <Tooltip
                      title={
                        entityData[propertyUri][index].lang
                          ? languageName(
                              entityData[propertyUri][index].lang,
                              i18n.language,
                            )
                          : t("tooltips.noLanguage")
                      }
                    >
                    <Select
                      value={entityData[propertyUri][index].lang ?? ""}
                      onChange={(e) =>
                        onUpdateValueLanguage(propertyUri, index, e.target.value)
                      }
                      displayEmpty
                      disabled={
                        !classUri || !!entityData[propertyUri][index].inferred
                      }
                      inputProps={{ "aria-label": t("tooltips.valueLanguage") }}
                      // Closed: just the code, so the field stays narrow. Open:
                      // the full name, since a code alone is hard to pick from.
                      renderValue={(value) =>
                        value ? (value as string).toUpperCase() : "—"
                      }
                      sx={{ "& .MuiSelect-select": { py: 0.75, fontSize: "0.8rem" } }}
                    >
                      {/* A dash rather than words: the same "unset" marker
                          the label editor uses. */}
                      <MenuItem value="" aria-label={t("tooltips.noLanguage")}>
                        <em>—</em>
                      </MenuItem>
                      {VALUE_LANGUAGES.map((code) => (
                        <MenuItem key={code} value={code} sx={{ fontSize: "0.85rem" }}>
                          {languageName(code, i18n.language)}
                        </MenuItem>
                      ))}
                    </Select>
                    </Tooltip>
                  </FormControl>
                ) : (
                  entityData[propertyUri][index].lang &&
                  ((showLanguageTags && isLinguistic(propertyUri)) ||
                    ambiguousProperties.has(propertyUri)) && (
                    <Tooltip
                      title={languageName(
                        entityData[propertyUri][index].lang,
                        i18n.language,
                      )}
                    >
                      <Chip
                        label={entityData[propertyUri][index].lang}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.65rem", textTransform: "uppercase" }}
                      />
                    </Tooltip>
                  )
                )}
                {entityData[propertyUri][index].inferred && showInferredMarks && (
                  <Tooltip title={t("common:labels.inferredHelp", { ns: "common" })}>
                    <Chip
                      label={t("common:labels.inferred", { ns: "common" })}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: "0.65rem" }}
                    />
                  </Tooltip>
                )}
                {isEditing && !entityData[propertyUri][index].inferred && (
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
            )}
          </OrderableValueList>
        </Box>
      ))}
    </>
  );
};

export default React.memo(DataPropertiesSection);
