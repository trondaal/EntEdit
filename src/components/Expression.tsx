import React from "react";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
} from "@mui/material";
import type { SearchResult } from "../hooks/useSearchQueries";

interface ExpressionProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (uri: string) => void;
}

const Expression: React.FC<ExpressionProps> = ({
  result,
  isSelected,
  onSelect,
}) => {
  return (
    <ListItem disablePadding>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(result.uri)}
      >
        <ListItemText
          primary={result.label || result.uri.split("#").pop() || result.uri}
          secondary={
            <Box>
              <Typography variant="body2" color="text.secondary" noWrap>
                {result.uri}
              </Typography>
              {result.description && (
                <Typography variant="body2" color="text.secondary">
                  {result.description}
                </Typography>
              )}
              {result.type && (
                <Typography variant="caption" color="primary">
                  Type: {result.type.split("#").pop() || result.type}
                </Typography>
              )}
            </Box>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Expression;
