import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";

export interface SearchResult {
  uri: string;
  label?: string;
  etitle?: string;
  wtitle?: string;
  agents?: string;
  language?: string;
  contentType?: string;
  workType?: string;
  type?: string;
  score?: number;
}

export const useSearchEntities = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useQuery({
    queryKey: ["search", config.url, query, language],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const client = new SparqlClient(config);

      // GraphDB Lucene connector search query
      // This query uses the lucene:query predicate to perform fulltext search
      const sparqlQuery = `
        PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
        PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT DISTINCT ?entity ?label ?score WHERE {
          ?search a inst:entitiesIndex ;
                  lucene:query "${query.replace(/"/g, '\\"')}" ;
                  lucene:entities ?entity .
                  ?entity lucene:score ?score .
                  ?entity a <http://rdaregistry.info/Elements/c/C10006> .


          OPTIONAL {
            ?entity rdfs:label ?labelLit .
            FILTER(LANG(?labelLit) = "" || LANG(?labelLit) = "${language}")
            BIND(STR(?labelLit) AS ?label)
          }

        }
        ORDER BY DESC(?score)
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.entity.value,
        label: binding.label?.value,
        description: binding.description?.value,
        type: binding.type?.value,
        score: binding.score ? parseFloat(binding.score.value) : undefined,
      }));
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
