import React, { useState } from "react";
import {
  ListItem,
  ListItemText,
  Typography,
  Box,
  Chip,
  Collapse,
  Link,
  IconButton,
  Tooltip,
} from "@mui/material";
import { ExpandMore, ExpandLess, AccountTree, ContentCopy } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type { EntitySearchHandler } from "../utils/searchLink";
import CollapsibleNote from "./CollapsibleNote";
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { getGraphVisualizationUrl, openGraphVisualization } from "../utils/graphUtils";
import { useExpressionDetail, useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import { useLogging } from "../hooks/useLogging";
import ExpressionList from "./ExpressionList";
import { RelationshipLines } from "./ResultLines";
import { presentManifestation } from "../utils/manifestationPresentation";
import {
  capitalizeFirstLetter,
  parseCreators,
  splitPipeValues,
  splitSemicolonValues,
  formatTitleArea,
  formatPublicationPhysicalSeries,
  formatNotes,
  formatIdentifiers,
} from "../utils/textFormatters";
import { getCarrierTypeIcon, typeIconSx } from "../utils/contentTypeIcons";

interface ManifestationSearchResultProps {
  result: ManifestationSearchResultType;
  /** Click on the entry; absent where the entry is part of a list under a result */
  onSelect?: (uri: string) => void;
  selectedLanguage: string;
  config: SparqlEndpointConfig;
  /**
   * The expression this manifestation is listed under, when it is. That expression
   * is the row above, so it is not merged into the entry a second time: a
   * manifestation of one expression would otherwise repeat the row above for every
   * publication of it. Everything else follows the rule below, and Contents stays full.
   */
  parentExpressionUri?: string;
  onEntitySearch: EntitySearchHandler;
}

const ManifestationSearchResult: React.FC<ManifestationSearchResultProps> = ({
  result,
  onSelect,
  selectedLanguage,
  config,
  parentExpressionUri,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { logEvent } = useLogging();
  const [expressionsExpanded, setExpressionsExpanded] = useState(false);
  const graphUrl = getGraphVisualizationUrl(config.url, result.uri);

  // What the entry merges and lists as contents: utils/manifestationPresentation.ts
  const {
    isSingleExpression,
    collectionUri,
    mergeSingleExpression,
    mergedCollectionUri,
    contentsCount,
  } = presentManifestation(result, parentExpressionUri);
  const { data: expressions } = useExpressionsByManifestation(
    config,
    mergeSingleExpression ? result.uri : null,
    selectedLanguage,
  );
  const { data: collectionExpression } = useExpressionDetail(config, mergedCollectionUri, selectedLanguage);
  const singleExpression = isSingleExpression ? expressions?.[0] : collectionExpression ?? undefined;

  const handleToggleExpressions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expressionsExpanded) logEvent({ type: "search_result_expanded", section: "contents", uri: result.uri });
    setExpressionsExpanded(!expressionsExpanded);
  };

  // Pre-compute formatted values to avoid double-calling in render
  const titleArea = formatTitleArea(result);
  const publicationLine = formatPublicationPhysicalSeries(result);
  const notesLine = formatNotes(result.notes);
  const identifiersLine = formatIdentifiers(result.identifiers);

  // Collect all metadata chips (manifestation-level)
  const allChips: string[] = [];
  if (result.mediatype) {
    allChips.push(...splitPipeValues(result.mediatype));
  }
  if (result.carriertype) {
    allChips.push(...splitPipeValues(result.carriertype));
  }
  // Add expression-level chips when single expression is loaded
  if (singleExpression) {
    if (singleExpression.language) {
      allChips.push(...splitSemicolonValues(singleExpression.language));
    }
    if (singleExpression.contenttype) {
      allChips.push(...splitSemicolonValues(singleExpression.contenttype));
    }
    if (singleExpression.workcategory) {
      allChips.push(...splitSemicolonValues(singleExpression.workcategory));
    }
    if (singleExpression.genre) {
      allChips.push(...splitSemicolonValues(singleExpression.genre));
    }
  }

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
          onClick={onSelect ? () => onSelect(result.uri) : undefined}
          sx={{ width: "100%", px: 2, py: 1 }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {/* Line 1: Title area with visualization button */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  {React.createElement(
                    getCarrierTypeIcon(result.carriertypeUri, result.mediatypeUri),
                    { sx: typeIconSx },
                  )}
                  <Typography
                    variant="body1"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 500,
                      lineHeight: 1.5,
                      fontSize: '0.9375rem',
                    }}
                  >
                    {titleArea}
                  </Typography>
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
                          logEvent({ type: "graph_visualization_opened", entityUri: result.uri, source: "search" });
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

                {/* Line 2: Publication area + Physical description + Series */}
                {publicationLine && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.5,
                      fontSize: '0.8125rem',
                    }}
                  >
                    {publicationLine}
                  </Typography>
                )}

                {/* Line 3: Notes, collapsed to two lines when long */}
                {notesLine && <CollapsibleNote text={notesLine} entityUri={result.uri} />}

                {/* Line 4: Identifiers (all on one line) */}
                {identifiersLine && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.4,
                    }}
                  >
                    {identifiersLine}
                  </Typography>
                )}

                {/* Creators (manifestation-level + expression-level when single expression) */}
                {(result.manifestation_creators || (singleExpression && (singleExpression.work_creators || singleExpression.expression_creators))) && (
                  <Box>
                    {result.manifestation_creators && parseCreators(result.manifestation_creators).map((creator, index) => (
                      <Typography
                        key={`m-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
                          {creator.names.map((entry, nameIndex) => (
                            <React.Fragment key={nameIndex}>
                              {nameIndex > 0 && ' ; '}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(entry.name, { uri: entry.uri, kind: "agent" });
                                }}
                                sx={{
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  verticalAlign: 'baseline',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                }}
                              >
                                {entry.name}
                              </Link>
                            </React.Fragment>
                          ))}
                        </Box>
                      </Typography>
                    ))}
                    {singleExpression?.work_creators && parseCreators(singleExpression.work_creators).map((creator, index) => (
                      <Typography
                        key={`wc-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
                          {creator.names.map((entry, nameIndex) => (
                            <React.Fragment key={nameIndex}>
                              {nameIndex > 0 && ' ; '}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(entry.name, { uri: entry.uri, kind: "agent" });
                                }}
                                sx={{
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  verticalAlign: 'baseline',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                }}
                              >
                                {entry.name}
                              </Link>
                            </React.Fragment>
                          ))}
                        </Box>
                      </Typography>
                    ))}
                    {singleExpression?.expression_creators && parseCreators(singleExpression.expression_creators).map((creator, index) => (
                      <Typography
                        key={`ec-${index}`}
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                      >
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {capitalizeFirstLetter(creator.role)}:
                        </Box>
                        {' '}
                        <Box component="span">
                          {creator.names.map((entry, nameIndex) => (
                            <React.Fragment key={nameIndex}>
                              {nameIndex > 0 && ' ; '}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  onEntitySearch(entry.name, { uri: entry.uri, kind: "agent" });
                                }}
                                sx={{
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: 'underline' },
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  verticalAlign: 'baseline',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                }}
                              >
                                {entry.name}
                              </Link>
                            </React.Fragment>
                          ))}
                        </Box>
                      </Typography>
                    ))}
                  </Box>
                )}

                {/* Relationships (expression-level when single expression) */}
                {singleExpression && (
                  <Box>
                    <Box sx={{ mb: 0.5 }}>
                      <RelationshipLines
                        relationships={singleExpression.work_to_work_relationships}
                        collapsed={singleExpression.work_collapsed_relationships}
                        kind="work"
                        entityUri={singleExpression.work_uri}
                        config={config}
                        language={selectedLanguage}
                        onEntitySearch={onEntitySearch}
                      />
                    </Box>
                    <RelationshipLines
                      relationships={singleExpression.expression_to_expression_relationships}
                      collapsed={singleExpression.expression_collapsed_relationships}
                      kind="expression"
                      entityUri={singleExpression.uri}
                      config={config}
                      language={selectedLanguage}
                      onEntitySearch={onEntitySearch}
                    />
                  </Box>
                )}

                {/* Metadata chips */}
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.5,
                }}>
                  {!isSingleExpression && (
                    <Chip
                      label={contentsCount != null ? t('search.contentsCount', { count: contentsCount }) : t('search.contents')}
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={handleToggleExpressions}
                      icon={expressionsExpanded ? <ExpandLess /> : <ExpandMore />}
                      sx={{
                        mr: 1,
                        cursor: 'pointer',
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        '& .MuiChip-label': { overflow: 'visible' },
                        '& .MuiChip-icon': { fontSize: '1rem' },
                      }}
                    />
                  )}
                  {allChips.map((chip, index) => (
                    <Chip
                      key={`chip-${index}`}
                      label={capitalizeFirstLetter(chip)}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            }
          />
        </Box>
      </ListItem>
      {!isSingleExpression && (
        <Collapse in={expressionsExpanded} timeout="auto" unmountOnExit>
          <ExpressionList
            config={config}
            manifestationUri={result.uri}
            selectedLanguage={selectedLanguage}
            excludeUri={collectionUri}
            onEntitySearch={onEntitySearch}
          />
        </Collapse>
      )}
    </Box>
  );
};

export default ManifestationSearchResult;
