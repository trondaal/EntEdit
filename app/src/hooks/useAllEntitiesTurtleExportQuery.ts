import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { PredObjBinding } from "../utils/turtleSerializer";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import { notDeprecated } from "../utils/sparqlFragments";
import type { SparqlEndpointConfig } from "../types/sparql";

/**
 * On-demand hook that fetches all triples for entities of the given classes,
 * with the value order of their own statements, grouped by subject for
 * serializing as one Turtle document (`serializeGraphToTurtle`).
 *
 * When `classUris` is empty, exports every entity whose type is an active
 * class in the ontology.  When specific class URIs are provided, only
 * entities belonging to those classes are included.
 *
 * Uses `enabled: false` so the query only runs when `refetch()` is called.
 */
export function useAllEntitiesTurtleExportQuery(
  config: SparqlEndpointConfig,
  classUris: string[] = [],
) {
  const classKey = classUris.length > 0 ? [...classUris].sort().join(",") : "all";

  const { data: graph = null, isLoading, isFetching, error, refetch } = useQuery<
    Map<string, PredObjBinding[]> | null,
    Error
  >({
    queryKey: ["turtle-export-classes", config.url, classKey],
    queryFn: async () => {
      const client = new SparqlClient(config);

      // Build the class filter: either a VALUES clause for selected classes,
      // or fall back to all active classes from the ontology
      const classFilter = classUris.length > 0
        ? `VALUES ?class { ${classUris.map((u) => `<${sanitizeSparqlUri(u)}>`).join(" ")} }`
        : `?class a owl:Class . ?class entedit:status "class" .`;

      const query = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT ?subject ?predicate ?object ?order
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?subject a ?class .
          ${classFilter}
          {
            ?subject ?predicate ?object .
            FILTER NOT EXISTS {
              ?subject a ?moreSpecific .
              ?moreSpecific rdfs:subClassOf+ ?object .
              FILTER(?moreSpecific != ?object && ?predicate = rdf:type)
            }
            # Value order set in the editor (RDF-star annotation)
            OPTIONAL { << ?subject ?predicate ?object >> entedit:valueOrder ?order . }
          }
          UNION
          {
            ?other ?incomingPred ?subject .
            ?predicate owl:inverseOf ?incomingPred .
            ${notDeprecated("?predicate")}
            FILTER NOT EXISTS { ?subject ?predicate ?other }
            BIND(?other AS ?object)
          }
        }
        ORDER BY ?subject ?predicate ?object
      `;

      const response = await client.queryWithoutInference(query);

      const subjectMap = new Map<string, PredObjBinding[]>();
      for (const b of response.results.bindings) {
        const subjectUri = b.subject?.value;
        if (!subjectUri) continue;
        let list = subjectMap.get(subjectUri);
        if (!list) {
          list = [];
          subjectMap.set(subjectUri, list);
        }
        list.push({
          predicate: b.predicate,
          object: b.object,
          order: b.order ? parseInt(b.order.value, 10) : undefined,
        });
      }

      return subjectMap;
    },
    enabled: false,
    staleTime: 0,
  });

  return { graph, isLoading: isLoading || isFetching, error, refetch };
}
