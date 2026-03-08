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
import { useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

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
  const {
    data: expressions,
    isLoading,
    error,
  } = useExpressionsByManifestation(config, manifestationUri, selectedLanguage);

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Helper function to split semicolon-separated values into array
  const splitValues = (value: string | undefined): string[] => {
    if (!value) return [];
    return value.split(/\s*;\s*/).map(v => v.trim()).filter(v => v.length > 0);
  };

  // Parse creator strings with URI support
  // Input format: "rolelabel: name = uri & name = uri ; rolelabel: name = uri"
  const parseCreators = (creatorString: string | undefined) => {
    if (!creatorString) return [] as Array<{ role: string; names: Array<{ name: string; uri?: string }> }>;

    const roleGroups = creatorString.split(';').map(group => group.trim());

    return roleGroups.flatMap(group => {
      const colonIndex = group.indexOf(':');
      if (colonIndex === -1) return [];

      const role = group.substring(0, colonIndex).trim();
      const namesString = group.substring(colonIndex + 1).trim();
      const names = namesString.split('&').map(entry => {
        const parts = entry.trim().split(' = ');
        return {
          name: parts[0]?.trim() || '',
          uri: parts.length > 1 ? parts[1]?.trim() : undefined,
        };
      }).filter(entry => entry.name.length > 0);

      return [{ role, names }];
    });
  };

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
          Error loading expressions: {(error as Error).message}
        </Typography>
      </Box>
    );
  }

  if (!expressions || expressions.length === 0) {
    return (
      <Box sx={{ p: 2, pl: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No expressions found
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {expressions.map((expression) => {
        // Determine primary title
        const primaryTitle = expression.title || expression.work_title || expression.uri;
        const showWorkTitle = expression.work_title && expression.title && expression.work_title !== expression.title;

        // Collect all metadata chips
        const allChips: string[] = [];
        if (expression.language) {
          allChips.push(...splitValues(expression.language));
        }
        if (expression.contenttype) {
          allChips.push(...splitValues(expression.contenttype));
        }
        if (expression.worktype) {
          allChips.push(...splitValues(expression.worktype));
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
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      lineHeight: 1.5,
                      mb: 0.5,
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
