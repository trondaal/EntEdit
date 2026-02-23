import React from "react";
import { Box, Typography } from "@mui/material";
import type { SparqlEndpointConfig } from "../types/sparql";
import ObjectPropertyValue from "./ObjectPropertyValue";

interface ObjectPropertySectionProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  propertyLabel: string;
  values: string[];
  rangeUri?: string;
  isEditing: boolean;
  selectedLanguage: string;
  onUpdateValue: (index: number, value: string) => void;
  onRemoveValue: (index: number) => void;
}

const ObjectPropertySection: React.FC<ObjectPropertySectionProps> = ({
  config,
  propertyLabel,
  values,
  rangeUri,
  isEditing,
  selectedLanguage,
  onUpdateValue,
  onRemoveValue,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {propertyLabel}
      </Typography>
      {values.map((value, index) => (
        <ObjectPropertyValue
          key={`${value}-${index}`}
          config={config}
          value={value}
          rangeUri={rangeUri}
          isEditing={isEditing}
          selectedLanguage={selectedLanguage}
          onUpdate={(newValue) => onUpdateValue(index, newValue)}
          onRemove={() => onRemoveValue(index)}
        />
      ))}
    </Box>
  );
};

export default React.memo(ObjectPropertySection);
