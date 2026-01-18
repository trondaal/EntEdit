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
} from "@mui/material";
import { useExpressionsByManifestation } from "../hooks/useExpressionQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

interface ExpressionListProps {
  config: SparqlEndpointConfig;
  manifestationUri: string;
  selectedLanguage: string;
}

const ExpressionList: React.FC<ExpressionListProps> = ({
  config,
  manifestationUri,
  selectedLanguage,
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

        // Combine creators
        const creators: string[] = [];
        if (expression.work_creators) {
          creators.push(...splitValues(expression.work_creators));
        }
        if (expression.expression_creators) {
          creators.push(...splitValues(expression.expression_creators));
        }

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
                  {creators.length > 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                        mb: 0.5,
                      }}
                    >
                      {creators.join(" ; ")}
                    </Typography>
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
