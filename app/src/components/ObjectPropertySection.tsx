import React, { useMemo } from "react";
import { Box } from "@mui/material";
import type { SparqlEndpointConfig, OrderedValue } from "../types/sparql";
import ObjectPropertyValue from "./ObjectPropertyValue";
import PropertyValues from "./PropertyValues";

interface ObjectPropertySectionProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  propertyLabel: string;
  values: OrderedValue[];
  rangeUri?: string;
  isEditing: boolean;
  showInferredMarks: boolean;
  selectedLanguage: string;
  onUpdateValue: (index: number, value: string) => void;
  onRemoveValue: (index: number) => void;
  onReorderValues: (propertyUri: string, fromIndex: number, toIndex: number) => void;
}

const ObjectPropertySection: React.FC<ObjectPropertySectionProps> = ({
  config,
  propertyUri,
  propertyLabel,
  values,
  rangeUri,
  isEditing,
  showInferredMarks,
  selectedLanguage,
  onUpdateValue,
  onRemoveValue,
  onReorderValues,
}) => {
  const itemIds = useMemo(
    () => values.map((v, i) => `${propertyUri}--${i}--${v.order}`),
    [values, propertyUri],
  );

  return (
    <Box sx={{ mb: 2 }}>
      <PropertyValues
        propertyUri={propertyUri}
        label={propertyLabel}
        itemIds={itemIds}
        isEditing={isEditing}
        onReorder={onReorderValues}
      >
        {(index) => (
          <ObjectPropertyValue
            config={config}
            value={values[index].value}
            rangeUri={rangeUri}
            isEditing={isEditing}
            inferred={values[index].inferred}
            showInferredMarks={showInferredMarks}
            selectedLanguage={selectedLanguage}
            onUpdate={(newValue) => onUpdateValue(index, newValue)}
            onRemove={() => onRemoveValue(index)}
          />
        )}
      </PropertyValues>
    </Box>
  );
};

export default React.memo(ObjectPropertySection);
