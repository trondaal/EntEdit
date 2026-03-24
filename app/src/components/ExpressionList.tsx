import React from "react";
import {
  List,
  CircularProgress,
  Typography,
  Box,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Link,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  capitalizeFirstLetter,
  parseCreators,
  parseRelationships,
  splitSemicolonValues,
} from "../utils/textFormatters";
import { getContentTypeIcon, typeIconSmallSx } from "../utils/contentTypeIcons";

interface ExpressionListProps {
  config: SparqlEndpointConfig;
  manifestationUri: string;
  selectedLanguage: string;
  onEntitySearch?: (name: string) => void;
}

const ExpressionList: React.FC<ExpressionListProps> = ({
  config,
  manifestationUri,
  selectedLanguage,
  onEntitySearch,
}) => {
  const { t } = useTranslation();
  const {
    data: expressions,
    isLoading,
    error,
  } = useExpressionsByManifestation(config, manifestationUri, selectedLanguage);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2, pl: 4 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, pl: 4 }}>
        <Typography variant="body2" color="error">
          {t("search.errorLoadingExpressions", { message: (error as Error).message })}
        </Typography>
      </Box>
    );
  }

  if (!expressions || expressions.length === 0) {
    return (
      <Box sx={{ p: 2, pl: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t("search.noExpressionsFound")}
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {expressions.map((expression) => {
        // Determine primary title and icon
        const ContentTypeIcon = getContentTypeIcon(expression.contenttypeUri);
        const primaryTitle = expression.title || expression.work_title || expression.uri;
        const showWorkTitle = expression.work_title && expression.title && expression.work_title !== expression.title;

        // Collect all metadata chips
        const allChips: string[] = [];
        if (expression.language) {
          allChips.push(...splitSemicolonValues(expression.language));
        }
        if (expression.contenttype) {
          allChips.push(...splitSemicolonValues(expression.contenttype));
        }
        if (expression.workcategory) {
          allChips.push(...splitSemicolonValues(expression.workcategory));
        }
        if (expression.genre) {
          allChips.push(...splitSemicolonValues(expression.genre));
        }

        // Parse creators with URI support
        const workCreators = parseCreators(expression.work_creators);
        const expressionCreators = parseCreators(expression.expression_creators);
        const allCreators = [...workCreators, ...expressionCreators];

        return (
          <ListItem
            key={expression.uri}
            disablePadding
            sx={{
              pl: 4,
              bgcolor: (theme) => theme.palette.mode === 'light'
                ? 'grey.50'
                : 'grey.900',
            }}
          >
            <ListItemButton>
              <ListItemText
              primary={
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                    <ContentTypeIcon sx={typeIconSmallSx} />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {primaryTitle}
                    {showWorkTitle && (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({expression.work_title})
                      </Typography>
                    )}
                  </Typography>
                  </Box>

                  {/* Creators */}
                  {allCreators.length > 0 && (
                    <Box sx={{ mb: 0.5 }}>
                      {allCreators.map((creator, creatorIndex) => (
                        <Typography
                          key={creatorIndex}
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            fontSize: '0.8125rem',
                            lineHeight: 1.5,
                          }}
                        >
                          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {capitalizeFirstLetter(creator.role)}:
                          </Box>
                          {' '}
                          <Box component="span">
                            {creator.names.map((entry, nameIndex) => (
                              <React.Fragment key={nameIndex}>
                                {nameIndex > 0 && ' ; '}
                                {onEntitySearch ? (
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
                                ) : (
                                  entry.name
                                )}
                              </React.Fragment>
                            ))}
                          </Box>
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {/* Relationships */}
                  {(expression.work_to_work_relationships || expression.expression_to_expression_relationships) && (
                    <Box sx={{ mb: 0.5 }}>
                      {expression.work_to_work_relationships && (
                        <Box>
                          {parseRelationships(expression.work_to_work_relationships).map((rel, relIndex) => (
                            <Typography
                              key={`w2w-${relIndex}`}
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
                                    {onEntitySearch ? (
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
                                    ) : (
                                      <Box component="span" sx={{ fontStyle: 'italic' }}>{entry.title}</Box>
                                    )}
                                  </React.Fragment>
                                ))}
                              </Box>
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {expression.expression_to_expression_relationships && (
                        <Box>
                          {parseRelationships(expression.expression_to_expression_relationships).map((rel, relIndex) => (
                            <Typography
                              key={`e2e-${relIndex}`}
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
                                    {onEntitySearch ? (
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
                                    ) : (
                                      <Box component="span" sx={{ fontStyle: 'italic' }}>{entry.title}</Box>
                                    )}
                                  </React.Fragment>
                                ))}
                              </Box>
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Metadata chips */}
                  {allChips.length > 0 && (
                    <Box sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.75,
                      mt: 1,
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
                    </Box>
                  )}
                </Box>
              }
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};

export default ExpressionList;
