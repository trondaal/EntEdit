import React, { useState } from "react";
import {
  ListItem,
  ListItemText,
  Box,
  Typography,
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import { AccountTree, ContentCopy } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type { EntitySearchHandler } from "../utils/searchLink";
import type { WorkSearchResult } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { getGraphVisualizationUrl, openGraphVisualization } from "../utils/graphUtils";
import { splitSemicolonValues } from "../utils/textFormatters";
import { getContentTypeIcon, typeIconSx } from "../utils/contentTypeIcons";
import { CategoryChip, CreatorLines, ExpandChip, RelationshipLines } from "./ResultLines";
import WorkExpressionList from "./WorkExpressionList";

interface WorkProps {
  result: WorkSearchResult;
  onSelect: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedLanguage: string;
  onEntitySearch: EntitySearchHandler;
}

/**
 * A work in the work search: presented like the work part of a content
 * result (title, creators, relationships to other works, category and genre),
 * with its expressions in a list that is loaded when it is opened.
 */
const Work: React.FC<WorkProps> = ({
  result,
  onSelect,
  config,
  selectedLanguage,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [expressionsExpanded, setExpressionsExpanded] = useState(false);
  const graphUrl = getGraphVisualizationUrl(config.url, result.uri);

  const title = result.work_title || result.work_label || result.uri.split("#").pop() || result.uri;

  const handleToggleExpressions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpressionsExpanded(!expressionsExpanded);
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        mb: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <ListItem disablePadding>
        <Box
          onClick={() => onSelect(result.uri)}
          sx={{ width: "100%", px: 2, py: 1 }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                {React.createElement(
                  getContentTypeIcon(result.contenttypeUri),
                  { sx: typeIconSx },
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.9375rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {title}
                  </Typography>
                </Box>
                <Tooltip title={t("entityEditor:tooltips.copyUri")}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(result.uri).then(
                        () => enqueueSnackbar(t("entityEditor:messages.uriCopied"), { variant: "success", autoHideDuration: 2000 }),
                        () => enqueueSnackbar(t("entityEditor:messages.copyFailed"), { variant: "error" }),
                      );
                    }}
                    sx={{
                      ml: 1,
                      mt: -0.5,
                      p: 0.5,
                      color: 'text.disabled',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <ContentCopy sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
                {graphUrl && (
                  <Tooltip title={t("common:buttons.graph")}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openGraphVisualization(config.url, result.uri);
                      }}
                      sx={{
                        mt: -0.5,
                        p: 0.5,
                        color: 'text.disabled',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <AccountTree sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            }
            secondary={
              <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                <CreatorLines creators={result.work_creators} onEntitySearch={onEntitySearch} />
                <RelationshipLines
                  relationships={result.work_to_work_relationships}
                  kind="work"
                  onEntitySearch={onEntitySearch}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.25 }}>
                  <ExpandChip
                    label={result.expression_count != null
                      ? t("search.expressionsCount", { count: result.expression_count })
                      : t("search.expressions")}
                    expanded={expressionsExpanded}
                    onToggle={handleToggleExpressions}
                  />
                  {splitSemicolonValues(result.workcategory).map((wc, index) => (
                    <CategoryChip key={`wc-${index}`} label={wc} />
                  ))}
                  {splitSemicolonValues(result.genre).map((g, index) => (
                    <CategoryChip key={`genre-${index}`} label={g} />
                  ))}
                </Box>
              </Box>
            }
            slotProps={{ secondary: { component: "div" } }}
          />
        </Box>
      </ListItem>
      <Collapse in={expressionsExpanded} timeout="auto" unmountOnExit>
        <WorkExpressionList
          config={config}
          workUri={result.uri}
          selectedLanguage={selectedLanguage}
          onEntitySearch={onEntitySearch}
        />
      </Collapse>
    </Box>
  );
};

export default Work;
