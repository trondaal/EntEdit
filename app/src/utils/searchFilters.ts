/**
 * Category filters for the content search, and their counts.
 *
 * The expression index holds the category IRIs in four unanalyzed fields
 * (see database/lucene_connectors/expressions_index.sparql). Filters become
 * Lucene clauses, so paging, the hit count and the counts per category all
 * come from the index: values selected within a category are alternatives
 * (OR), categories narrow each other (AND).
 */
import { sanitizeSparqlUri } from "./labelUtils";
import type { SparqlResult } from "../types/sparql";

/** Index fields offered as filters, in display order. */
export const FILTER_FIELDS = ["language", "contentType", "workType", "genre"] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

/** Selected category IRIs per field. */
export type SearchFilters = Partial<Record<FilterField, string[]>>;

export interface FacetValue {
  value: string;
  count: number;
}

/** Values present in a result set, with their number of hits, per field. */
export type Facets = Partial<Record<FilterField, FacetValue[]>>;

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
