import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import type { SparqlEndpointConfig, RdfProperty, OrderedValue } from "../types/sparql";
import { formatLabel } from "../utils/labelUtils";
import EntityPickerPanel from "./EntityPickerPanel";
import ObjectPropertySection from "./ObjectPropertySection";

interface ObjectPropertyGroupProps {
  config: SparqlEndpointConfig;
  sectionTitle: string;
  addLabel: string;
  selectorPromptLabel: string;
  properties: RdfProperty[];
  statusFilter: string;
  entityData: Record<string, OrderedValue[]>;
  isEditing: boolean;
  classUri: string;
  selectedLanguage: string;
  onUpdateValue: (property: string, index: number, value: string) => void;
  onRemoveValue: (property: string, index: number) => void;
  onReorderValues: (property: string, fromIndex: number, toIndex: number) => void;
  onAddProperty: (propertyUri: string, entityUri: string) => void;
}

const ObjectPropertyGroup: React.FC<ObjectPropertyGroupProps> = ({
  config,
  sectionTitle,
  addLabel,
  selectorPromptLabel,
  properties,
  statusFilter,
  entityData,
  isEditing,
  classUri,
  selectedLanguage,
  onUpdateValue,
  onRemoveValue,
  onReorderValues,
  onAddProperty,
}) => {
  const [selectedProperty, setSelectedProperty] = useState("");

  const availableProperties = useMemo(
    () => properties.filter((p) => p.status === statusFilter),
    [properties, statusFilter],
  );

  const propertiesWithValues = useMemo(
    () =>
      Object.keys(entityData).filter((prop) => {
        const hasValues = entityData[prop] && entityData[prop].length > 0;
        const matches = properties.some(
          (p) => p.uri === prop && p.status === statusFilter,
        );
        return hasValues && matches;
      }),
    [entityData, properties, statusFilter],
  );

  const getPropertyLabel = useCallback(
    (uri: string) => {
      const prop = properties.find((p) => p.uri === uri);
      return formatLabel(prop?.label, uri);
    },
    [properties],
  );

  const handleSelect = useCallback(
    (entityUri: string) => {
      if (selectedProperty && entityUri) {
        // Prevent adding the same entity URI twice for the same property
        const existing = entityData[selectedProperty] || [];
        if (!existing.some((v) => v.value === entityUri)) {
          onAddProperty(selectedProperty, entityUri);
        }
        setSelectedProperty("");
      }
    },
    [selectedProperty, entityData, onAddProperty],
  );

  const handleCancel = useCallback(() => setSelectedProperty(""), []);

  // Don't render the section at all if there's nothing to show
  if (
    propertiesWithValues.length === 0 &&
    !(isEditing && availableProperties.length > 0)
  ) {
    return null;
  }

  return (
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
        <Typography variant="subtitle1">{sectionTitle}</Typography>

        {isEditing && availableProperties.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{addLabel}</InputLabel>
            <Select
              value={selectedProperty}
              label={addLabel}
              onChange={(e) => setSelectedProperty(e.target.value)}
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

      {selectedProperty && (
        <EntityPickerPanel
          config={config}
          propertyUri={selectedProperty}
          rangeUri={
            properties.find((p) => p.uri === selectedProperty)?.range
          }
          selectedLanguage={selectedLanguage}
          promptLabel={selectorPromptLabel}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      )}

      {propertiesWithValues.map((propertyUri) => (
        <ObjectPropertySection
          key={propertyUri}
          config={config}
          propertyUri={propertyUri}
          propertyLabel={getPropertyLabel(propertyUri)}
          values={entityData[propertyUri]}
          rangeUri={properties.find((p) => p.uri === propertyUri)?.range}
          isEditing={isEditing && !!classUri}
          selectedLanguage={selectedLanguage}
          onUpdateValue={(index, value) =>
            onUpdateValue(propertyUri, index, value)
          }
          onRemoveValue={(index) => onRemoveValue(propertyUri, index)}
          onReorderValues={onReorderValues}
        />
      ))}
    </>
  );
};

export default React.memo(ObjectPropertyGroup);
