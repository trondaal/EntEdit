import React from "react";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import EntityPickerPanel from "./EntityPickerPanel";

interface RelatedAgentsSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const RelatedAgentsSelector: React.FC<RelatedAgentsSelectorProps> = (props) => {
  const { t } = useTranslation("entityEditor");
  return (
    <EntityPickerPanel
      {...props}
      promptLabel={t("messages.selectRelatedAgent")}
    />
  );
};

export default React.memo(RelatedAgentsSelector);
