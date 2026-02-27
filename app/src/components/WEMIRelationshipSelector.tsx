import React from "react";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import EntityPickerPanel from "./EntityPickerPanel";

interface WEMIRelationshipSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const WEMIRelationshipSelector: React.FC<WEMIRelationshipSelectorProps> = (props) => {
  const { t } = useTranslation("entityEditor");
  return (
    <EntityPickerPanel
      {...props}
      promptLabel={t("messages.selectWEMIEntity")}
    />
  );
};

export default React.memo(WEMIRelationshipSelector);
