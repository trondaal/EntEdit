import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { PredObjBinding } from "../utils/turtleSerializer";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import type { SparqlEndpointConfig } from "../types/sparql";

/**
 * On-demand hook that fetches all triples for an entity, with the value
 * order of its own statements, for serializing as Turtle (`serializeToTurtle`).
 *
 * Queries WITHOUT inference to avoid duplicates from property subtype
 * hierarchies. Incoming triples (where this entity is the object) are
 * converted to the entity's perspective via owl:inverseOf.
 *
 * Uses `enabled: false` so the query only runs when `refetch()` is called.
 */
export function useTurtleExportQuery(
  config: SparqlEndpointConfig,
  entityUri: string | null,
) {
  const { data: bindings = null, isLoading, error, refetch } = useQuery<PredObjBinding[] | null, Error>({
    queryKey: ["turtle-export", config.url, entityUri],
    queryFn: async () => {
      if (!entityUri) return null;

      const client = new SparqlClient(config);
      const sanitizedUri = sanitizeSparqlUri(entityUri);
      const query = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT ?predicate ?object ?order
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          {
            # Outgoing explicitly asserted triples.
            # Drop rdf:type assertions to a supertype when a more specific
            # type is also asserted on the same subject.
            <${sanitizedUri}> ?predicate ?object .
            FILTER NOT EXISTS {
              <${sanitizedUri}> a ?moreSpecific .
              ?moreSpecific rdfs:subClassOf+ ?object .
              FILTER(?moreSpecific != ?object && ?predicate = rdf:type)
            }
            # Value order set in the editor (RDF-star annotation)
            OPTIONAL { << <${sanitizedUri}> ?predicate ?object >> entedit:valueOrder ?order . }
          }
          UNION
          {
            # Incoming triples converted via owl:inverseOf.
            # Skip when the explicit outgoing triple already exists, to
            # avoid duplicating it via the inverse property.
            ?object ?incomingPred <${sanitizedUri}> .
            ?predicate owl:inverseOf ?incomingPred .
            FILTER NOT EXISTS { <${sanitizedUri}> ?predicate ?object }
          }
        }
        ORDER BY ?predicate ?object
      `;

      const response = await client.queryWithoutInference(query);
      return response.results.bindings.map((b) => ({
        predicate: b.predicate,
        object: b.object,
        order: b.order ? parseInt(b.order.value, 10) : undefined,
      }));
    },
    enabled: false,
    staleTime: 0,
  });

  return { bindings, isLoading, error, refetch };
}
