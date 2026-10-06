import React, { useState } from "react";
import {
  List,
  CircularProgress,
  Typography,
  Box,
  ListItem,
  ListItemText,
  Collapse,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { EntitySearchHandler } from "../utils/searchLink";
import { useExpressionsByWork, type Expression } from "../hooks/useExpressionQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { splitSemicolonValues } from "../utils/textFormatters";
import { getContentTypeIcon, typeIconSmallSx } from "../utils/contentTypeIcons";
import { CategoryChip, CreatorLines, ExpandChip, RelationshipLines } from "./ResultLines";
import ManifestationList from "./ManifestationList";

interface WorkExpressionListProps {
  config: SparqlEndpointConfig;
  workUri: string;
  selectedLanguage: string;
  onEntitySearch: EntitySearchHandler;
}

const sectionSx = {
  bgcolor: "rgba(139, 92, 42, 0.12)",
  borderTop: 1,
  borderColor: "divider",
} as const;

/**
 * One expression of a work. The work's own creators, relationships and
 * categories are on the work above, so only what belongs to the expression
 * is shown, with its publications in a list loaded when it is opened.
 */
const WorkExpression: React.FC<{
  expression: Expression;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  onEntitySearch: EntitySearchHandler;
}> = ({ expression, config, selectedLanguage, onEntitySearch }) => {
  const { t } = useTranslation();
  const [manifestationsExpanded, setManifestationsExpanded] = useState(false);
  const title = expression.title || expression.work_title || expression.uri;

  return (
    <ListItem disablePadding sx={{ pl: 4, display: "block" }}>
      <Box sx={{ width: "100%", px: 2, py: 1 }}>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
              {React.createElement(getContentTypeIcon(expression.contenttypeUri), { sx: typeIconSmallSx })}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                }}
              >
                {title}
              </Typography>
            </Box>
          }
          secondary={
            <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <CreatorLines creators={expression.expression_creators} onEntitySearch={onEntitySearch} />
              <RelationshipLines
                relationships={expression.expression_to_expression_relationships}
                kind="expression"
                onEntitySearch={onEntitySearch}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.25 }}>
                <ExpandChip
                  label={expression.manifestation_count != null
                    ? t("search.publicationsCount", { count: expression.manifestation_count })
                    : t("search.publications")}
                  expanded={manifestationsExpanded}
                  onToggle={(e) => {
                    e.stopPropagation();
                    setManifestationsExpanded(!manifestationsExpanded);
                  }}
                />
                {splitSemicolonValues(expression.language).map((lang, index) => (
                  <CategoryChip key={`lang-${index}`} label={lang} />
                ))}
                {splitSemicolonValues(expression.contenttype).map((ct, index) => (
                  <CategoryChip key={`ct-${index}`} label={ct} />
                ))}
              </Box>
            </Box>
          }
          slotProps={{ secondary: { component: "div" } }}
        />
      </Box>
      <Collapse in={manifestationsExpanded} timeout="auto" unmountOnExit>
        <ManifestationList
          config={config}
          expressionUri={expression.uri}
          selectedLanguage={selectedLanguage}
          onEntitySearch={onEntitySearch}
        />
      </Collapse>
    </ListItem>
  );
};

/** Expressions of a work, under a work search result. */
const WorkExpressionList: React.FC<WorkExpressionListProps> = ({
  config,
  workUri,
  selectedLanguage,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const { data: expressions, isLoading, error } = useExpressionsByWork(config, workUri, selectedLanguage);

  if (isLoading) {
    return (
      <Box sx={{ ...sectionSx, display: "flex", justifyContent: "center", p: 2, pl: 4 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ ...sectionSx, p: 2, pl: 4 }}>
        <Typography variant="body2" color="error">
          {t("search.errorLoadingExpressions", { message: (error as Error).message })}
        </Typography>
      </Box>
    );
  }

  if (!expressions || expressions.length === 0) {
    return (
      <Box sx={{ ...sectionSx, p: 2, pl: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t("search.noExpressionsFound")}
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding sx={sectionSx}>
      {expressions.map((expression) => (
        <WorkExpression
          key={expression.uri}
          expression={expression}
          config={config}
          selectedLanguage={selectedLanguage}
          onEntitySearch={onEntitySearch}
        />
      ))}
    </List>
  );
};

export default WorkExpressionList;
