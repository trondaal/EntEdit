import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { serializeGraphToTurtle } from "../utils/turtleSerializer";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import type { SparqlBinding, SparqlEndpointConfig } from "../types/sparql";

/**
 * On-demand hook that fetches all triples for every entity of a given class
 * and serializes them as a single formatted Turtle document.
 *
 * Mirrors `useTurtleExportQuery` but operates on a whole class:
 *   - queries WITHOUT inference to avoid duplicates from property subtype hierarchies
 *   - includes incoming triples via owl:inverseOf, expressed from each subject's perspective
 *   - groups bindings by subject and shares one prefix header across all blocks
 *
 * Uses `enabled: false` so the query only runs when `refetch()` is called.
 */
export function useClassTurtleExportQuery(
  config: SparqlEndpointConfig,
  classUri: string | null,
) {
  const { data: turtle = null, isLoading, isFetching, error, refetch } = useQuery<
    string | null,
    Error
  >({
    queryKey: ["turtle-export-class", config.url, classUri],
    queryFn: async () => {
      if (!classUri) return null;

      const client = new SparqlClient(config);
      const sanitizedClass = sanitizeSparqlUri(classUri);
      const query = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?subject ?predicate ?object
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?subject a <${sanitizedClass}> .
          {
            # Outgoing explicitly asserted triples.
            # Drop rdf:type assertions to a supertype when a more specific
            # type is also asserted on the same subject.
            ?subject ?predicate ?object .
            FILTER NOT EXISTS {
              ?subject a ?moreSpecific .
              ?moreSpecific rdfs:subClassOf+ ?object .
              FILTER(?moreSpecific != ?object && ?predicate = rdf:type)
            }
          }
          UNION
          {
            # Incoming triples converted via owl:inverseOf.
            # Skip when the explicit outgoing triple from ?subject already
            # exists, to avoid duplicating it via the inverse property.
            ?other ?incomingPred ?subject .
            ?predicate owl:inverseOf ?incomingPred .
            FILTER NOT EXISTS { ?subject ?predicate ?other }
            BIND(?other AS ?object)
          }
        }
        ORDER BY ?subject ?predicate ?object
      `;

      const response = await client.queryWithoutInference(query);

      // Group bindings by subject URI, preserving order from the result set
      const subjectMap = new Map<
        string,
        Array<{ predicate: SparqlBinding; object: SparqlBinding }>
      >();
      for (const b of response.results.bindings) {
        const subjectUri = b.subject?.value;
        if (!subjectUri) continue;
        let list = subjectMap.get(subjectUri);
        if (!list) {
          list = [];
          subjectMap.set(subjectUri, list);
        }
        list.push({ predicate: b.predicate, object: b.object });
      }

      return serializeGraphToTurtle(subjectMap);
    },
    enabled: false,
    staleTime: 0,
  });

  return { turtle, isLoading: isLoading || isFetching, error, refetch };
}
