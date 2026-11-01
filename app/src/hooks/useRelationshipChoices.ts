import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import {
  buildRelationshipListQuery,
  buildRelationshipUsageQuery,
  parseRelationshipList,
  parseRelationshipUsage,
  type RelationshipEntry,
} from "../utils/relationshipList";
import type { SparqlEndpointConfig } from "../types/sparql";

const FIVE_MINUTES = 5 * 60 * 1000;

/** The relationships of one level the search results can show, in label order. */
export const useRelationshipList = (
  config: SparqlEndpointConfig,
  classUri: string,
  language: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ["relationshipList", config.url, classUri, language],
    queryFn: async ({ signal }): Promise<RelationshipEntry[]> => {
      const client = new SparqlClient(config);
      const response = await client.query(buildRelationshipListQuery(classUri, language), { signal });
      return parseRelationshipList(response.results.bindings);
    },
    enabled,
    staleTime: FIVE_MINUTES,
  });

/**
 * How many entities of the repository show each of `uris`. Counted once per level, when
 * its tab is opened; a failure (a very large repository can exceed the query time limit)
 * only leaves the numbers out, the list works without them.
 */
export const useRelationshipUsage = (
  config: SparqlEndpointConfig,
  classUri: string,
  uris: readonly string[],
  enabled: boolean,
) =>
  useQuery({
    queryKey: ["relationshipUsage", config.url, classUri, uris.length],
    queryFn: async ({ signal }): Promise<Map<string, number>> => {
      const client = new SparqlClient(config);
      const response = await client.query(buildRelationshipUsageQuery(uris), { signal });
      return parseRelationshipUsage(response.results.bindings, uris);
    },
    enabled: enabled && uris.length > 0,
    staleTime: FIVE_MINUTES,
    retry: false,
  });
