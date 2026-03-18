import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import type { SparqlEndpointConfig, OrderedValue } from "../types/sparql";
import ObjectPropertyValue from "./ObjectPropertyValue";
import OrderableValueList from "./OrderableValueList";

interface ObjectPropertySectionProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  propertyLabel: string;
  values: OrderedValue[];
  rangeUri?: string;
  isEditing: boolean;
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {propertyLabel}
      </Typography>
      <OrderableValueList
        propertyUri={propertyUri}
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
            selectedLanguage={selectedLanguage}
            onUpdate={(newValue) => onUpdateValue(index, newValue)}
            onRemove={() => onRemoveValue(index)}
          />
        )}
      </OrderableValueList>
    </Box>
  );
};

export default React.memo(ObjectPropertySection);
