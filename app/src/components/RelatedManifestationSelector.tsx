import React from "react";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import EntityPickerPanel from "./EntityPickerPanel";

interface RelatedManifestationSelectorProps {
  config: SparqlEndpointConfig;
  propertyUri: string;
  rangeUri?: string;
  selectedLanguage: string;
  onSelect: (entityUri: string) => void;
  onCancel: () => void;
}

const RelatedManifestationSelector: React.FC<RelatedManifestationSelectorProps> = (props) => {
  const { t } = useTranslation("entityEditor");
  return (
    <EntityPickerPanel
      {...props}
      promptLabel={t("messages.selectRelatedManifestation")}
    />
  );
};

export default React.memo(RelatedManifestationSelector);
