/**
 * Category filters for the publication, content and work searches, and their counts.
 *
 * The manifestation, expression and work indexes hold the category IRIs in
 * unanalyzed fields (see database/lucene_connectors/). Filters become
 * Lucene clauses, so paging, the hit count and the counts per category all
 * come from the index: values selected within a category are alternatives
 * (OR), categories narrow each other (AND).
 */
import { sanitizeSparqlUri } from "./labelUtils";
import type { SparqlResult } from "../types/sparql";

/** Index fields offered as filters, in display order: work, expression, manifestation. */
export const FILTER_FIELDS = [
  "workType",
  "genre",
  "language",
  "contentType",
  "mediaType",
  "carrierType",
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

export type SearchIndex = "expressionsIndex" | "manifestationsIndex" | "worksIndex";

/**
 * Filters offered per index. A manifestation has the categories of the
 * expressions it embodies and their works: it counts, and matches, once
 * per value that at least one of them has. A work likewise has the
 * language and content type of each of its expressions.
 */
export const INDEX_FILTER_FIELDS: Record<SearchIndex, readonly FilterField[]> = {
  expressionsIndex: ["workType", "genre", "language", "contentType"],
  manifestationsIndex: FILTER_FIELDS,
  worksIndex: ["workType", "genre", "language", "contentType"],
};

/** Selected category IRIs per field. */
export type SearchFilters = Partial<Record<FilterField, string[]>>;

export interface FacetValue {
  value: string;
  count: number;
}

/** Values present in a result set, with their number of hits, per field. */
export type Facets = Partial<Record<FilterField, FacetValue[]>>;

/**
 * Keys for the order in which selections were made, oldest first: one per
 * checked value, and `LINK_SELECTION` for a followed link. The chips of the
 * filter panel are listed in this order.
 */
export const LINK_SELECTION = "link";
export const selectionKey = (field: FilterField, value: string): string => `${field}\u0000${value}`;
export const parseSelectionKey = (key: string): { field: FilterField; value: string } | null => {
  const at = key.indexOf("\u0000");
  return at < 0 ? null : { field: key.slice(0, at) as FilterField, value: key.slice(at + 1) };
};

export const hasFilters = (filters: SearchFilters): boolean =>
  FILTER_FIELDS.some((field) => (filters[field]?.length ?? 0) > 0);

/** The same filters in a stable form, for cache keys. */
export const normalizeFilters = (filters: SearchFilters): SearchFilters =>
  Object.fromEntries(
    FILTER_FIELDS.filter((field) => filters[field]?.length).map((field) => [
      field,
      [...new Set(filters[field])].sort(),
    ]),
  );

/** Adds or removes one value. */
export const toggleFilter = (
  filters: SearchFilters,
  field: FilterField,
  value: string,
): SearchFilters => {
  const current = filters[field] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...filters, [field]: next };
};

/** An IRI as a Lucene phrase; the unanalyzed field matches it whole. */
const phrase = (iri: string): string =>
  `"${sanitizeSparqlUri(iri).replace(/[\\"]/g, (c) => `\\${c}`)}"`;

/**
 * Lucene clauses for the filters, one required group per field. `except`
 * leaves out one field: its own counts must not be narrowed by its own
 * selection, or choosing German would hide the count for French.
 */
export const toFilterClauses = (filters: SearchFilters, except?: FilterField): string =>
  FILTER_FIELDS.filter((field) => field !== except && filters[field]?.length)
    .map((field) => `+(${filters[field]!.map((iri) => `${field}:${phrase(iri)}`).join(" ")})`)
    .join(" ");

/** Search text (already a Lucene query) and filters; everything when both are empty. */
export const combineQuery = (textQuery: string, filterClauses: string): string =>
  [textQuery, filterClauses].filter(Boolean).join(" ") || "*:*";

/** Reads `lucene:facets` rows (?name ?value ?count), keeping only filter fields. */
export const parseFacets = (rows: SparqlResult[]): Facets => {
  const facets: Facets = {};
  for (const row of rows) {
    const field = row.name?.value as FilterField;
    if (!FILTER_FIELDS.includes(field) || !row.value) continue;
    (facets[field] ??= []).push({ value: row.value.value, count: parseInt(row.count.value, 10) });
  }
  for (const values of Object.values(facets)) values.sort((a, b) => b.count - a.count);
  return facets;
};
