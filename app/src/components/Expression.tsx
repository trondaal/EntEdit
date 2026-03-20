import React, { useState } from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  Collapse,
  Chip,
  Link,
  IconButton,
  Tooltip,
} from "@mui/material";
import { ExpandMore, ExpandLess, AccountTree, ContentCopy } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import type { ExpressionSearchResult } from "../hooks/useSearchQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import { getGraphVisualizationUrl } from "../utils/graphUtils";
import ManifestationList from "./ManifestationList";
import { capitalizeFirstLetter, splitSemicolonValues, parseCreators } from "../utils/textFormatters";
import { getContentTypeIcon, typeIconSx } from "../utils/contentTypeIcons";

interface ExpressionProps {
  result: ExpressionSearchResult;
  isSelected: boolean;
  onSelect: (uri: string) => void;
  config: SparqlEndpointConfig;
  selectedManifestationUri: string | null;
  onManifestationSelect: (uri: string) => void;
  selectedLanguage: string;
  onEntitySearch: (name: string) => void;
  initialExpanded?: boolean;
}

const Expression: React.FC<ExpressionProps> = ({
  result,
  isSelected,
  onSelect,
  config,
  selectedManifestationUri,
  onManifestationSelect,
  selectedLanguage,
  onEntitySearch,
  initialExpanded = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [manifestationsExpanded, setManifestationsExpanded] = useState(initialExpanded);
  const graphUrl = getGraphVisualizationUrl(config.url, result.uri);

  // Determine the primary display title
  // Priority: expression_title > work_title > URI
  const primaryTitle = result.expression_title || result.work_title || result.uri.split("#").pop() || result.uri;

  // Show work_title in parentheses only if:
  // 1. work_title exists AND
  // 2. expression_title exists (so work_title is not already the primary title) AND
  // 3. they are different
  const showWorkTitle = result.work_title && result.expression_title && result.work_title !== result.expression_title;

  // Helper function to parse and format relationship strings
  // Example input: "har del av verk: All the pretty horses = http://viaf.org/viaf/214001528 & Cities of the plain = http://viaf.org/viaf/3417153653286155900001 ; er bearbeidet som spillefilm (verk): All the pretty horses = https://www.imdb.com/title/tt0149624"
  // Output: Array of { relationshipLabel, titles: Array<{ title, uri? }> }
  const parseRelationships = (relationshipString: string | undefined): Array<{ relationshipLabel: string; titles: Array<{ title: string; uri?: string }> }> => {
    if (!relationshipString) return [];

    const result: Array<{ relationshipLabel: string; titles: Array<{ title: string; uri?: string }> }> = [];

    // Split by semicolon to get individual relationship groups (already grouped by label from SPARQL)
    const relationshipGroups = relationshipString.split(';').map(group => group.trim());

    relationshipGroups.forEach(group => {
      // Split by colon to separate relationship label from title+URI pairs
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return;

      const relationshipLabel = group.substring(0, colonIndex).trim();
      const titleAndUriPairs = group.substring(colonIndex + 1).trim();

      // Split by ' & ' to get individual title=URI pairs
      const titles: Array<{ title: string; uri?: string }> = [];
      const pairs = titleAndUriPairs.split('&').map(pair => pair.trim());

      pairs.forEach(pair => {
        const parts = pair.split(' = ');
        const title = parts[0]?.trim();
        const uri = parts[1]?.trim();
        if (title) {
          titles.push({ title, uri });
        }
      });

      if (titles.length > 0) {
        result.push({ relationshipLabel, titles });
      }
    });

    return result;
  };

  const ContentTypeIcon = getContentTypeIcon(result.contenttype);

  const handleToggleManifestations = (e: React.MouseEvent) => {
    e.stopPropagation();
    setManifestationsExpanded(!manifestationsExpanded);
  };

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelect(result.uri)}
        >
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                <ContentTypeIcon sx={typeIconSx} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 500,
                      fontSize: '0.9375rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {primaryTitle}
                  </Typography>
                  {showWorkTitle && (
                    <Typography
                      component="span"
                      sx={{
                        fontStyle: 'italic',
                        fontSize: '0.875rem',
                        color: 'text.secondary',
                        ml: 1,
                      }}
                    >
                      ({result.work_title})
                    </Typography>
                  )}
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
            }
            secondary={
              <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>

                {/* Section 1: Creators */}
                {(result.work_creators || result.expression_creators) && (
                  <Box>
                    {result.work_creators && (
                      <Box>
                        {parseCreators(result.work_creators).map((creator, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                          >
                            <Box
                              component="span"
                              className="creator-role"
                              sx={{
                                fontWeight: 500,
                                color: 'text.primary',
                              }}
                            >
                              {capitalizeFirstLetter(creator.role)}:
                            </Box>{' '}
                            <Box
                              component="span"
                              className="creator-names"
                            >
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
                    {result.expression_creators && (
                      <Box>
                        {parseCreators(result.expression_creators).map((creator, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}
                          >
                            <Box
                              component="span"
                              className="creator-role"
                              sx={{
                                fontWeight: 500,
                                color: 'text.primary',
                              }}
                            >
                              {capitalizeFirstLetter(creator.role)}:
                            </Box>{' '}
                            <Box
                              component="span"
                              className="creator-names"
                            >
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
                  </Box>
                )}

                {/* Section 2: Relationships */}
                {(result.work_to_work_relationships || result.expression_to_expression_relationships) && (
                  <Box>
                    {result.work_to_work_relationships && (
                      <Box sx={{ mb: 0.5 }}>
                        {parseRelationships(result.work_to_work_relationships).map((rel, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.8125rem',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'baseline',
                              '&:not(:last-child)': { mb: 0.25 }
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.75rem',
                                mr: 0.5,
                              }}
                            >
                              →
                            </Box>
                            <Box component="span">
                              {capitalizeFirstLetter(rel.relationshipLabel)}:{' '}
                              {rel.titles.map((entry, titleIndex) => (
                                <React.Fragment key={titleIndex}>
                                  {titleIndex > 0 && ' ; '}
                                  <Link
                                    component="button"
                                    variant="body2"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onEntitySearch(entry.title);
                                    }}
                                    sx={{
                                      textDecoration: 'none',
                                      fontStyle: 'italic',
                                      '&:hover': { textDecoration: 'underline' },
                                      cursor: 'pointer',
                                      color: 'inherit',
                                      fontSize: 'inherit',
                                      lineHeight: 'inherit',
                                      verticalAlign: 'baseline',
                                    }}
                                  >
                                    {entry.title}
                                  </Link>
                                </React.Fragment>
                              ))}
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {result.expression_to_expression_relationships && (
                      <Box>
                        {parseRelationships(result.expression_to_expression_relationships).map((rel, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.8125rem',
                              lineHeight: 1.5,
                              display: 'flex',
                              alignItems: 'baseline',
                              '&:not(:last-child)': { mb: 0.25 }
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                color: 'text.disabled',
                                fontSize: '0.75rem',
                                mr: 0.5,
                              }}
                            >
                              →
                            </Box>
                            <Box component="span">
                              {capitalizeFirstLetter(rel.relationshipLabel)}:{' '}
                              {rel.titles.map((entry, titleIndex) => (
                                <React.Fragment key={titleIndex}>
                                  {titleIndex > 0 && ' ; '}
                                  <Link
                                    component="button"
                                    variant="body2"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      onEntitySearch(entry.title);
                                    }}
                                    sx={{
                                      textDecoration: 'none',
                                      fontStyle: 'italic',
                                      '&:hover': { textDecoration: 'underline' },
                                      cursor: 'pointer',
                                      color: 'inherit',
                                      fontSize: 'inherit',
                                      lineHeight: 'inherit',
                                      verticalAlign: 'baseline',
                                    }}
                                  >
                                    {entry.title}
                                  </Link>
                                </React.Fragment>
                              ))}
                            </Box>
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Section 3: Metadata Tags - Use chip-style layout */}
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mt: 0.25,
                }}>
                  {splitSemicolonValues(result.language).map((lang, index) => (
                    <Chip
                      key={`lang-${index}`}
                      label={capitalizeFirstLetter(lang)}
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
                  {splitSemicolonValues(result.contenttype).map((ct, index) => (
                    <Chip
                      key={`ct-${index}`}
                      label={capitalizeFirstLetter(ct)}
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
                  {splitSemicolonValues(result.workcategory).map((wc, index) => (
                    <Chip
                      key={`wc-${index}`}
                      label={capitalizeFirstLetter(wc)}
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
                  {splitSemicolonValues(result.genre).map((g, index) => (
                    <Chip
                      key={`genre-${index}`}
                      label={capitalizeFirstLetter(g)}
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
                  <Chip
                    label={result.manifestation_count != null ? t('search.publicationsCount', { count: result.manifestation_count }) : t('search.publications')}
                    size="small"
                    variant="outlined"
                    onClick={handleToggleManifestations}
                    icon={manifestationsExpanded ? <ExpandLess /> : <ExpandMore />}
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
                </Box>

              </Box>
            }
          />
        </ListItemButton>
      </ListItem>
      <Collapse in={manifestationsExpanded} timeout="auto" unmountOnExit>
        <ManifestationList
          config={config}
          expressionUri={result.uri}
          selectedManifestationUri={selectedManifestationUri}
          onManifestationSelect={onManifestationSelect}
          selectedLanguage={selectedLanguage}
          onEntitySearch={onEntitySearch}
        />
      </Collapse>
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
    </>
  );
};

export default Expression;
