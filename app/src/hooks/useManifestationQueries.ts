import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  buildCollectionQuery,
  buildManifestationDetailQuery,
  manifestationsOfExpression,
  toManifestationDetail,
  withCollections,
  type ManifestationDetail,
} from "../utils/wemiQueries";

/**
 * The manifestations of an expression, described like the publication search
 * describes its results: with the detail query and the collection query side by
 * side, so a list under an expression can present each one the same way
 * (`ManifestationSearchResult`).
 */
export const useManifestations = (
  config: SparqlEndpointConfig,
  expressionUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: ["manifestations", config.url, expressionUri, language],
    queryFn: async ({ signal }): Promise<ManifestationDetail[]> => {
      if (!expressionUri) {
        return [];
      }

      const client = new SparqlClient(config);
      const scope = manifestationsOfExpression(expressionUri);
      const [details, collections] = await Promise.all([
        client.query(buildManifestationDetailQuery(scope, language), { signal }),
        client.query(buildCollectionQuery(scope), { signal }),
      ]);
      return withCollections(
        details.results.bindings.map(toManifestationDetail),
        collections.results.bindings,
      );
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
