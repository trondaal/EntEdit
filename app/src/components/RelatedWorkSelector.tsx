import React from "react";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import EntityPickerPanel from "./EntityPickerPanel";

interface RelatedWorkSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const RelatedWorkSelector: React.FC<RelatedWorkSelectorProps> = (props) => {
  const { t } = useTranslation("entityEditor");
  return (
    <EntityPickerPanel
      {...props}
      promptLabel={t("messages.selectRelatedWork")}
    />
  );
};

export default React.memo(RelatedWorkSelector);
