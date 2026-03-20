import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
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
import type { ManifestationSearchResult as ManifestationSearchResultType } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { getGraphVisualizationUrl } from "../utils/graphUtils";
import { useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import ExpressionList from "./ExpressionList";
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

interface ManifestationSearchResultProps {
  result: ManifestationSearchResultType;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  selectedLanguage: string;
  config: SparqlEndpointConfig;
  onEntitySearch: (name: string) => void;
}

const ManifestationSearchResult: React.FC<ManifestationSearchResultProps> = ({
  result,
  isSelected,
  onSelect,
  selectedLanguage,
  config,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [expressionsExpanded, setExpressionsExpanded] = useState(false);
  const graphUrl = getGraphVisualizationUrl(config.url, result.uri);

  // Auto-fetch expression data when there is exactly one expression
  const isSingleExpression = result.expression_count === 1;
  const autoFetchUri = isSingleExpression ? result.uri : null;
  const { data: expressions } = useExpressionsByManifestation(config, autoFetchUri, selectedLanguage);
  const singleExpression = expressions?.[0];

  const handleToggleExpressions = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(result.uri)}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {/* Line 1: Title area with visualization button */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
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
                          window.open(graphUrl, "_blank", "noopener,noreferrer");
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
                                  onEntitySearch(entry.name);
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
                                  onEntitySearch(entry.name);
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
                                  onEntitySearch(entry.name);
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

                {/* Line 3: Notes (all on one line) */}
                {notesLine && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.4,
                    }}
                  >
                    {notesLine}
                  </Typography>
                )}

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

                {/* Metadata chips */}
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.5,
                }}>
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
                  {!isSingleExpression && (
                    <Chip
                      label={result.expression_count != null ? t('search.contentsCount', { count: result.expression_count }) : t('search.contents')}
                      size="small"
                      variant="outlined"
                      onClick={handleToggleExpressions}
                      icon={expressionsExpanded ? <ExpandLess /> : <ExpandMore />}
                      sx={{
                        ml: 2,
                        cursor: 'pointer',
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderColor: 'divider',
                        '& .MuiChip-label': { overflow: 'visible' },
                        '& .MuiChip-icon': { fontSize: '1rem' },
                      }}
                    />
                  )}
                </Box>
              </Box>
            }
          />
        </ListItemButton>
      </ListItem>
      {!isSingleExpression && (
        <Collapse in={expressionsExpanded} timeout="auto" unmountOnExit>
          <ExpressionList
            config={config}
            manifestationUri={result.uri}
            selectedLanguage={selectedLanguage}
            onEntitySearch={onEntitySearch}
          />
        </Collapse>
      )}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
    </>
  );
};

export default ManifestationSearchResult;
