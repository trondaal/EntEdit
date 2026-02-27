import React from "react";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import EntityPickerPanel from "./EntityPickerPanel";

interface RelatedExpressionSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const RelatedExpressionSelector: React.FC<RelatedExpressionSelectorProps> = (props) => {
  const { t } = useTranslation("entityEditor");
  return (
    <EntityPickerPanel
      {...props}
      promptLabel={t("messages.selectRelatedExpression")}
    />
  );
};

export default React.memo(RelatedExpressionSelector);
