/**
 * Creator and relationship lines and category chips of a search result,
 * styled like those of the content and publication results (`Expression`,
 * `ExpressionList`), for the work search and the expressions listed under a
 * work.
 */
import React from "react";
import { Box, Chip, Link, Typography } from "@mui/material";
import { ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { EntitySearchHandler, LinkKind } from "../utils/searchLink";
import { capitalizeFirstLetter, parseCreators, parseRelationships } from "../utils/textFormatters";

const linkSx = {
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" },
  cursor: "pointer",
  color: "inherit",
  verticalAlign: "baseline",
  fontSize: "inherit",
  lineHeight: "inherit",
} as const;

/** A name or title that starts a search for what it points to. */
const SearchLink: React.FC<{
  label: string;
  uri?: string;
  kind: LinkKind;
  italic?: boolean;
  onEntitySearch: EntitySearchHandler;
}> = ({ label, uri, kind, italic, onEntitySearch }) => (
  <Link
    component="button"
    variant="body2"
    onClick={(e: React.MouseEvent) => {
      e.stopPropagation();
      onEntitySearch(label, { uri, kind });
    }}
    sx={{ ...linkSx, ...(italic ? { fontStyle: "italic" } : {}) }}
  >
    {label}
  </Link>
);

/** "Role: name ; name", one line per role (`parseCreators`). */
export const CreatorLines: React.FC<{
  creators?: string;
  onEntitySearch: EntitySearchHandler;
}> = ({ creators, onEntitySearch }) => {
  if (!creators) return null;
  return (
    <Box>
      {parseCreators(creators).map((creator, index) => (
        <Typography
          key={index}
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.5, fontSize: "0.8125rem" }}
        >
          <Box component="span" sx={{ fontWeight: 500, color: "text.primary" }}>
            {capitalizeFirstLetter(creator.role)}:
          </Box>{" "}
          <Box component="span">
            {creator.names.map((entry, nameIndex) => (
              <React.Fragment key={nameIndex}>
                {nameIndex > 0 && " ; "}
                <SearchLink label={entry.name} uri={entry.uri} kind="agent" onEntitySearch={onEntitySearch} />
              </React.Fragment>
            ))}
          </Box>
        </Typography>
      ))}
    </Box>
  );
};

/** "→ Relationship: title ; title", one line per relationship (`parseRelationships`). */
export const RelationshipLines: React.FC<{
  relationships?: string;
  /** What the targets are: works or expressions */
  kind: "work" | "expression";
  onEntitySearch: EntitySearchHandler;
}> = ({ relationships, kind, onEntitySearch }) => {
  if (!relationships) return null;
  return (
    <Box>
      {parseRelationships(relationships).map((rel, index) => (
        <Typography
          key={index}
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "baseline",
            "&:not(:last-child)": { mb: 0.25 },
          }}
        >
          <Box component="span" sx={{ color: "text.disabled", fontSize: "0.75rem", mr: 0.5 }}>
            →
          </Box>
          <Box component="span">
            {capitalizeFirstLetter(rel.relationshipLabel)}:{" "}
            {rel.titles.map((entry, titleIndex) => (
              <React.Fragment key={titleIndex}>
                {titleIndex > 0 && " ; "}
                <SearchLink label={entry.title} uri={entry.uri} kind={kind} italic onEntitySearch={onEntitySearch} />
              </React.Fragment>
            ))}
          </Box>
        </Typography>
      ))}
    </Box>
  );
};

/** A category (language, content type, category of work, genre) as a chip. */
export const CategoryChip: React.FC<{ label: string }> = ({ label }) => (
  <Chip
    label={capitalizeFirstLetter(label)}
    size="small"
    variant="outlined"
    sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 500, borderColor: "divider" }}
  />
);

/** The chip that opens and closes the list under a result. */
export const ExpandChip: React.FC<{
  label: string;
  expanded: boolean;
  onToggle: (e: React.MouseEvent) => void;
}> = ({ label, expanded, onToggle }) => {
  const Icon = expanded ? ExpandLessIcon : ExpandMoreIcon;
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      color="primary"
      onClick={onToggle}
      icon={<Icon />}
      aria-expanded={expanded}
      sx={{
        mr: 1,
        cursor: "pointer",
        height: 20,
        fontSize: "0.6875rem",
        fontWeight: 500,
        "& .MuiChip-label": { overflow: "visible" },
        "& .MuiChip-icon": { fontSize: "1rem" },
      }}
    />
  );
};
