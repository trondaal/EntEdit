import React from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Delete, Tag } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { extractUriFragment, getPrimaryLabel } from "../utils/labelUtils";

interface ObjectPropertyValueProps {
  config: SparqlEndpointConfig;
  value: string;
  rangeUri?: string;
  isEditing: boolean;
  selectedLanguage: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
}

const ObjectPropertyValue: React.FC<ObjectPropertyValueProps> = ({
  config,
  value,
  isEditing,
  selectedLanguage,
  onRemove,
}) => {
  const { data: entity } = useQuery({
    queryKey: ["entity-label", config.url, value, selectedLanguage],
    queryFn: async () => {
      if (!value) return null;

      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?label ?lang
        WHERE {
          <${value}> rdfs:label ?label .
          BIND(LANG(?label) AS ?lang)
        }
      `;

      const response = await client.query(query);
      const labels = response.results.bindings.map((binding) => ({
        value: binding.label.value,
        language: binding.lang?.value || "",
      }));

      if (labels.length === 0) return null;

      return getPrimaryLabel(labels, selectedLanguage);
    },
    enabled: !!value && !!config.url,
  });

  const displayLabel = entity || extractUriFragment(value);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box
        sx={{
          flex: 1,
          p: 0.75,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: "bold", lineHeight: 1.2 }}
          >
            {displayLabel}
          </Typography>
          <Tooltip title={value} placement="bottom-start">
            <Tag sx={{ fontSize: "0.875rem", color: "text.disabled", flexShrink: 0 }} />
          </Tooltip>
        </Box>
      </Box>
      {isEditing && (
        <IconButton
          size="small"
          onClick={onRemove}
          color="error"
          sx={{ p: 0.5 }}
          aria-label="Remove property value"
        >
          <Delete fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export default React.memo(ObjectPropertyValue);
