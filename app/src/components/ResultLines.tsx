/**
 * Creator and relationship lines and category chips of a search result,
 * styled like those of the content and publication results (`Expression`,
 * `ExpressionList`), for the work search and the expressions listed under a
 * work.
 */
import React, { useState } from "react";
import { Box, Chip, CircularProgress, Link, Typography } from "@mui/material";
import { ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { EntitySearchHandler, LinkKind } from "../utils/searchLink";
import {
  capitalizeFirstLetter,
  parseCollapsedRelationships,
  parseCreators,
  parseRelationships,
  type CollapsedRelationship,
} from "../utils/textFormatters";
import { useRelationTargets } from "../hooks/useRelationTargets";
import { useLogging } from "../hooks/useLogging";
import { useResultDisplay } from "../hooks/useResultDisplay";
import { isHiddenPartLine } from "../utils/partRelations";
import { extractUriFragment } from "../utils/labelUtils";
import type { SparqlEndpointConfig } from "../types/sparql";

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
  /** Without one the name is plain text (lists shown where no search can start) */
  onEntitySearch?: EntitySearchHandler;
}> = ({ label, uri, kind, italic, onEntitySearch }) =>
  !onEntitySearch ? (
    <Box component="span" sx={italic ? { fontStyle: "italic" } : undefined}>
      {label}
    </Box>
  ) : (
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

/** The arrow and the text of one relationship line. */
const RelationshipLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="body2"
    color="text.secondary"
    component="div"
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
    <Box component="span">{children}</Box>
  </Typography>
);

/**
 * A relationship marked `entedit:collapse true` (a long list of parts, subjects,
 * adaptations): its label and how many targets it has, which opens the list.
 * The targets are fetched when it is opened, a page at a time, and keep the
 * title order. See `useRelationTargets`.
 */
const CollapsedRelationshipLine: React.FC<{
  relationship: CollapsedRelationship;
  kind: "work" | "expression" | "manifestation";
  entityUri: string;
  config: SparqlEndpointConfig;
  language: string;
  onEntitySearch?: EntitySearchHandler;
}> = ({ relationship, kind, entityUri, config, language, onEntitySearch }) => {
  const { t } = useTranslation();
  const { logEvent } = useLogging();
  const [open, setOpen] = useState(false);
  const targets = useRelationTargets(config, {
    entityUri,
    propertyUri: relationship.propertyUri,
    kind,
    language,
    enabled: open,
  });
  const label = capitalizeFirstLetter(relationship.relationshipLabel) ?? "";
  const loaded = targets.data?.pages.flat() ?? [];
  const Icon = open ? ExpandLessIcon : ExpandMoreIcon;

  return (
    <RelationshipLine>
      <Link
        component="button"
        variant="body2"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          if (!open) {
            logEvent({
              type: "search_result_expanded",
              section: "relationships",
              uri: entityUri,
              property: relationship.propertyUri,
            });
          }
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-label={t(open ? "search.relatedHide" : "search.relatedShow", { label })}
        sx={{ ...linkSx, display: "inline-flex", alignItems: "baseline", gap: 0.25 }}
      >
        {label} ({relationship.count})
        <Icon sx={{ fontSize: "1rem", alignSelf: "center" }} />
      </Link>
      {open && (
        <>
          {loaded.length > 0 && ": "}
          {loaded.map((target, index) => (
            <React.Fragment key={target.uri}>
              {index > 0 && " ; "}
              <SearchLink
                label={target.title || extractUriFragment(target.uri)}
                uri={target.uri}
                kind={kind}
                italic
                onEntitySearch={onEntitySearch}
              />
            </React.Fragment>
          ))}
          {targets.isFetching && (
            <CircularProgress size={12} sx={{ ml: 1, verticalAlign: "middle" }} />
          )}
          {targets.isError && (
            <Box component="span" sx={{ color: "error.main", ml: 1 }}>
              {t("search.relatedFailed")}
            </Box>
          )}
          {targets.hasNextPage && !targets.isFetching && (
            <Link
              component="button"
              variant="body2"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                targets.fetchNextPage();
              }}
              sx={{ ...linkSx, ml: 1, color: "primary.main" }}
            >
              {t("search.relatedMore", {
                count: Math.min(50, relationship.count - loaded.length),
                left: relationship.count - loaded.length,
              })}
            </Link>
          )}
        </>
      )}
    </RelationshipLine>
  );
};

/**
 * "→ Relationship: title ; title", one line per relationship (`parseRelationships`),
 * then one line per collapsed relationship with its count (`collapsed`, see
 * `CollapsedRelationshipLine`; it needs the entity the relationships belong to).
 */
export const RelationshipLines: React.FC<{
  relationships?: string;
  /** Relationships marked `entedit:collapse true`, counted (`parseCollapsedRelationships`) */
  collapsed?: string;
  /** What the targets are: works, expressions or manifestations */
  kind: "work" | "expression" | "manifestation";
  /** The entity the relationships belong to: needed to open a collapsed one */
  entityUri?: string;
  config?: SparqlEndpointConfig;
  language?: string;
  onEntitySearch?: EntitySearchHandler;
}> = ({ relationships, collapsed, kind, entityUri, config, language, onEntitySearch }) => {
  const { partLevels } = useResultDisplay();
  // The part pair is stated at both levels: the preference decides which one shows
  const inline = parseRelationships(relationships).filter(
    (rel) => !isHiddenPartLine(rel.propertyUri, kind, partLevels),
  );
  const counted = (entityUri && config && language ? parseCollapsedRelationships(collapsed) : []).filter(
    (rel) => !isHiddenPartLine(rel.propertyUri, kind, partLevels),
  );
  if (inline.length === 0 && counted.length === 0) return null;
  return (
    <Box>
      {inline.map((rel, index) => (
        <RelationshipLine key={index}>
          {capitalizeFirstLetter(rel.relationshipLabel)}:{" "}
          {rel.titles.map((entry, titleIndex) => (
            <React.Fragment key={titleIndex}>
              {titleIndex > 0 && " ; "}
              <SearchLink label={entry.title} uri={entry.uri} kind={kind} italic onEntitySearch={onEntitySearch} />
            </React.Fragment>
          ))}
        </RelationshipLine>
      ))}
      {counted.map((relationship) => (
        <CollapsedRelationshipLine
          key={relationship.propertyUri}
          relationship={relationship}
          kind={kind}
          entityUri={entityUri!}
          config={config!}
          language={language!}
          onEntitySearch={onEntitySearch}
        />
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
