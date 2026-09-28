import { useInfiniteQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { escapeSparqlLiteral } from "../utils/labelUtils";
import { hasFuzzyTerms, toLuceneQuery } from "../utils/luceneQuery";
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

/**
 * Hits for one page. The first page falls back to similar spellings when
 * the exact search finds nothing; later pages keep the mode of the first.
 */
const findHits = async (
  client: SparqlClient,
  index: string,
  query: string,
  { offset, fuzzy }: SearchPageParam,
  signal: AbortSignal,
): Promise<Hits & { fuzzy: boolean }> => {
  const hits = await searchPage(client, index, toLuceneQuery(query, { fuzzy }), offset, signal);
  if (hits.total > 0 || fuzzy || offset > 0 || !hasFuzzyTerms(query)) {
    return { ...hits, fuzzy };
  }
  const similar = await searchPage(client, index, toLuceneQuery(query, { fuzzy: true }), offset, signal);
  return { ...similar, fuzzy: true };
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

export const useSearchExpressions = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useInfiniteQuery({
    queryKey: ["searchExpressions", config.url, query, language],
    queryFn: async ({ pageParam, signal }): Promise<SearchPage<ExpressionSearchResult>> => {
      if (!query || query.trim().length === 0) {
        return EMPTY;
      }
      const client = new SparqlClient(config);
      const { uris, scores, total, fuzzy } = await findHits(client, "expressionsIndex", query, pageParam, signal);
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
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSearchManifestations = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useInfiniteQuery({
    queryKey: ["searchManifestations", config.url, query, language],
    queryFn: async ({ pageParam, signal }): Promise<SearchPage<ManifestationSearchResult>> => {
      if (!query || query.trim().length === 0) {
        return EMPTY;
      }
      const client = new SparqlClient(config);
      const { uris, total, fuzzy } = await findHits(client, "manifestationsIndex", query, pageParam, signal);
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
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
