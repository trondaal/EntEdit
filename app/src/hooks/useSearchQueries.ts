import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { escapeSparqlLiteral, sanitizeSparqlUri } from "../utils/labelUtils";
import { hasFuzzyTerms, toLuceneQuery } from "../utils/luceneQuery";
import { createLanguageFallbackFragment, getFallbackLanguage } from "../utils/sparqlFragments";
import {
  INDEX_FILTER_FIELDS,
  combineQuery,
  hasFilters,
  normalizeFilters,
  parseFacets,
  toFilterClauses,
  type Facets,
  type FilterField,
  type SearchFilters,
  type SearchIndex,
} from "../utils/searchFilters";
import {
  buildExpressionDetailQuery,
  buildManifestationDetailQuery,
  expressionScope,
  manifestationScope,
  toExpressionDetail,
  toManifestationDetail,
  type ExpressionDetail,
  type ManifestationDetail,
} from "../utils/wemiQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

/** Number of search results fetched per page */
export const SEARCH_PAGE_SIZE = 20;

export interface ExpressionSearchResult extends ExpressionDetail {
  score?: number;
}

export type ManifestationSearchResult = ManifestationDetail;

/** One page of search results. */
export interface SearchPage<T> {
  results: T[];
  /** Number of hits for the whole search, not just this page */
  total: number;
  /** No exact hits: the results match similar spellings */
  fuzzy: boolean;
}

/** Where the next page starts, and whether the search fell back to fuzzy. */
interface SearchPageParam {
  offset: number;
  fuzzy: boolean;
}

interface Hits {
  uris: string[];
  scores: Map<string, number>;
  total: number;
}

/**
 * Lucene search for one page of hits, best first. Paging is left to the
 * connector (`lucene:limit`/`lucene:offset`): with SPARQL's ORDER BY/LIMIT
 * every hit of a broad term would be handed over and sorted first.
 * The connector only indexes entities of its own class, so no type check.
 */
const searchPage = async (
  client: SparqlClient,
  index: string,
  luceneQuery: string,
  offset: number,
  signal: AbortSignal,
): Promise<Hits> => {
  const response = await client.query(`
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>

SELECT ?entity ?score ?total
WHERE {
    ?search a inst:${index} ;
        lucene:query "${escapeSparqlLiteral(luceneQuery)}" ;
        lucene:limit "${SEARCH_PAGE_SIZE}" ;
        lucene:offset "${offset}" ;
        lucene:totalHits ?total ;
        lucene:entities ?entity .
    ?entity lucene:score ?score .
}
`, { signal });
  const uris: string[] = [];
  const scores = new Map<string, number>();
  let total = 0;
  for (const hit of response.results.bindings) {
    total = parseInt(hit.total.value, 10);
    const uri = hit.entity.value;
    if (!scores.has(uri)) {
      uris.push(uri);
      scores.set(uri, parseFloat(hit.score.value));
    }
  }
  return { uris, scores, total };
};

/** Number of hits for a Lucene query. */
const countHits = async (
  client: SparqlClient,
  index: string,
  luceneQuery: string,
  signal: AbortSignal,
): Promise<number> => {
  const response = await client.query(`
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>

SELECT ?total
WHERE {
    ?search a inst:${index} ;
        lucene:query "${escapeSparqlLiteral(luceneQuery)}" ;
        lucene:limit "1" ;
        lucene:totalHits ?total .
}
`, { signal });
  const total = response.results.bindings[0]?.total?.value;
  return total ? parseInt(total, 10) : 0;
};

/**
 * Hits for one page. The first page falls back to similar spellings when
 * the search text has no exact hits; later pages keep the mode of the
 * first. Only the text decides: a text that matches but is filtered down to
 * nothing gets no hits, not a looser spelling. A ready-made `luceneText`
 * (e.g. an agent's name as a phrase, `toNameQuery`) is used as it is.
 */
const findHits = async (
  client: SparqlClient,
  index: string,
  text: string,
  filters: SearchFilters,
  { offset, fuzzy }: SearchPageParam,
  signal: AbortSignal,
  luceneText?: string,
): Promise<Hits & { fuzzy: boolean }> => {
  const filterClauses = toFilterClauses(filters);
  if (luceneText) {
    const linked = await searchPage(client, index, combineQuery(luceneText, filterClauses), offset, signal);
    // Nothing at all for a followed link, even without filters: an index
    // without the link fields (connectors not yet recreated) or a work
    // without expressions. Search the label as typed instead.
    if (linked.total > 0 || offset > 0 || (await countHits(client, index, luceneText, signal)) > 0) {
      return { ...linked, fuzzy: false };
    }
  }
  const run = (similar: boolean) =>
    searchPage(client, index, combineQuery(toLuceneQuery(text, { fuzzy: similar }), filterClauses), offset, signal);
  const hits = await run(fuzzy);
  if (hits.total > 0 || fuzzy || offset > 0 || !hasFuzzyTerms(text)) {
    return { ...hits, fuzzy };
  }
  if (filterClauses && (await countHits(client, index, toLuceneQuery(text), signal)) > 0) {
    return { ...hits, fuzzy };
  }
  return { ...(await run(true)), fuzzy: true };
};

/** The search text as Lucene query, with the same fallback as `findHits`. */
const textQueryFor = async (
  client: SparqlClient,
  index: string,
  text: string,
  signal: AbortSignal,
  luceneText?: string,
): Promise<string> => {
  // Same fallback as `findHits` when a followed link finds nothing at all
  if (luceneText && (await countHits(client, index, luceneText, signal)) > 0) return luceneText;
  const exact = toLuceneQuery(text);
  if (!hasFuzzyTerms(text)) return exact;
  return (await countHits(client, index, exact, signal)) > 0
    ? exact
    : toLuceneQuery(text, { fuzzy: true });
};

/** Values and hit counts of the given fields over all hits of a query. */
const facetCounts = async (
  client: SparqlClient,
  index: string,
  luceneQuery: string,
  fields: readonly FilterField[],
  signal: AbortSignal,
): Promise<Facets> => {
  const response = await client.query(`
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>

SELECT ?name ?value ?count
WHERE {
    ?search a inst:${index} ;
        lucene:query "${escapeSparqlLiteral(luceneQuery)}" ;
        lucene:limit "0" ;
        lucene:facetFields "${fields.join(",")}" ;
        lucene:facets ?facet .
    ?facet lucene:facetName ?name ;
        lucene:facetValue ?value ;
        lucene:facetCount ?count .
}
`, { signal });
  return parseFacets(response.results.bindings);
};

/** Details keyed by URI, returned in the order of `uris` (search rank). */
const inRankOrder = <T extends { uri: string }>(uris: string[], details: T[]): T[] => {
  const byUri = new Map(details.map((d) => [d.uri, d]));
  return uris.map((uri) => byUri.get(uri) ?? ({ uri } as T));
};

const FIRST_PAGE: SearchPageParam = { offset: 0, fuzzy: false };

const nextPage = (
  lastPage: SearchPage<unknown>,
  _all: unknown,
  { offset }: SearchPageParam,
): SearchPageParam | undefined =>
  offset + SEARCH_PAGE_SIZE < lastPage.total
    ? { offset: offset + SEARCH_PAGE_SIZE, fuzzy: lastPage.fuzzy }
    : undefined;

const EMPTY: SearchPage<never> = { results: [], total: 0, fuzzy: false };

/** Whether a search has anything to search for: text, filters or both. */
const hasCriteria = (query: string, filters: SearchFilters): boolean =>
  query.trim().length > 0 || hasFilters(filters);

export const useSearchExpressions = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
  filters: SearchFilters = {},
  /** Ready-made Lucene query used instead of `query` (see `findHits`) */
  luceneText?: string,
) => {
  const normalized = normalizeFilters(filters);
  return useInfiniteQuery({
    queryKey: ["searchExpressions", config.url, query, language, normalized, luceneText],
    queryFn: async ({ pageParam, signal }): Promise<SearchPage<ExpressionSearchResult>> => {
      if (!hasCriteria(query, normalized)) {
        return EMPTY;
      }
      const client = new SparqlClient(config);
      const { uris, scores, total, fuzzy } = await findHits(client, "expressionsIndex", query, normalized, pageParam, signal, luceneText);
      if (uris.length === 0) return { results: [], total, fuzzy };

      const details = await client.query(
        buildExpressionDetailQuery(expressionScope(uris), language),
        { signal },
      );
      const results = inRankOrder(uris, details.results.bindings.map(toExpressionDetail))
        .map((d) => ({ ...d, score: scores.get(d.uri) }));
      return { results, total, fuzzy };
    },
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextPage,
    enabled: hasCriteria(query, normalized),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Values of the filter fields, with hit counts, over everything a search
 * finds — or over the whole collection when it has neither text nor
 * filters. Only values that occur are returned.
 *
 * A field with a selection is counted without its own filter (one extra,
 * counts-only query each): with German chosen, the other languages must
 * still show how many hits they would add.
 */
export const useSearchFacets = (
  config: SparqlEndpointConfig,
  index: SearchIndex,
  query: string,
  filters: SearchFilters = {},
  enabled = true,
  /** Ready-made Lucene query used instead of `query` (see `findHits`) */
  luceneText?: string,
) => {
  const normalized = normalizeFilters(filters);
  return useQuery({
    queryKey: ["searchFacets", config.url, index, query, normalized, luceneText],
    queryFn: async ({ signal }): Promise<Facets> => {
      const client = new SparqlClient(config);
      const fields = INDEX_FILTER_FIELDS[index];
      const textQuery = await textQueryFor(client, index, query, signal, luceneText);
      const active = fields.filter((field) => normalized[field]?.length);
      const [facets, ...own] = await Promise.all([
        facetCounts(client, index, combineQuery(textQuery, toFilterClauses(normalized)), fields, signal),
        ...active.map((field) =>
          facetCounts(client, index, combineQuery(textQuery, toFilterClauses(normalized, field)), [field], signal),
        ),
      ]);
      active.forEach((field, i) => {
        facets[field] = own[i][field] ?? [];
      });
      return facets;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Labels of category IRIs: chosen language, untagged, then the other
 * language. Explicit statements only, as in the result chips: with
 * inference skos:altLabel counts as rdfs:label, so "Anthology" would
 * compete with the preferred "Anthologies".
 */
export const useFacetLabels = (
  config: SparqlEndpointConfig,
  iris: string[],
  language: string,
) => {
  const sorted = [...new Set(iris)].sort();
  return useQuery({
    queryKey: ["facetLabels", config.url, language, sorted],
    queryFn: async ({ signal }): Promise<Map<string, string>> => {
      const client = new SparqlClient(config);
      const response = await client.query(`
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?concept (SAMPLE(?label) AS ?conceptLabel)
FROM <http://www.ontotext.com/explicit>
WHERE {
    VALUES ?concept { ${sorted.map((iri) => `<${sanitizeSparqlUri(iri)}>`).join(" ")} }
    ${createLanguageFallbackFragment("?concept", escapeSparqlLiteral(language), getFallbackLanguage(language), "label", false)}
}
GROUP BY ?concept
`, { signal });
      return new Map(
        response.results.bindings
          .filter((b) => b.conceptLabel)
          .map((b) => [b.concept.value, b.conceptLabel.value]),
      );
    },
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useSearchManifestations = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
  filters: SearchFilters = {},
  /** Ready-made Lucene query used instead of `query` (see `findHits`) */
  luceneText?: string,
) => {
  const normalized = normalizeFilters(filters);
  return useInfiniteQuery({
    queryKey: ["searchManifestations", config.url, query, language, normalized, luceneText],
    queryFn: async ({ pageParam, signal }): Promise<SearchPage<ManifestationSearchResult>> => {
      if (!hasCriteria(query, normalized)) {
        return EMPTY;
      }
      const client = new SparqlClient(config);
      const { uris, total, fuzzy } = await findHits(client, "manifestationsIndex", query, normalized, pageParam, signal, luceneText);
      if (uris.length === 0) return { results: [], total, fuzzy };

      const details = await client.query(
        buildManifestationDetailQuery(manifestationScope(uris), language),
        { signal },
      );
      const results = inRankOrder(uris, details.results.bindings.map(toManifestationDetail));
      return { results, total, fuzzy };
    },
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextPage,
    enabled: hasCriteria(query, normalized),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
