import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { createSchemaLabelFragment } from "../utils/sparqlFragments";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import type {
  SparqlEndpointConfig,
  RdfClass,
  RdfProperty,
} from "../types/sparql";

/**
 * Deduplicates schema items by URI, keeping the first occurrence.
 *
 * Schema queries include non-identifying columns in SELECT (e.g. `?order`
 * or `?status`) which can yield multiple rows per property when the
 * ontology has duplicate `entedit:order` annotations. `DISTINCT` does
 * not help in that case because the rows differ in the extra column.
 * This defensive pass keeps the editor UI stable against such data.
 */
function dedupeByUri<T extends { uri: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.uri)) seen.set(item.uri, item);
  }
  return [...seen.values()];
}

export const useRdfClasses = (
  config: SparqlEndpointConfig,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-classes", config.url, language],
    queryFn: async ({ signal }): Promise<RdfClass[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?class ?label
        WHERE {
          ?class a owl:Class .
          ?class entedit:status "class" .
          ${createSchemaLabelFragment("?class", language)}
          OPTIONAL{
            ?class entedit:order ?order .
          }
        }
        ORDER BY asc(?order) desc(?label)
      `;

      const response = await client.query(query, { signal });
      return dedupeByUri(
        response.results.bindings.map((binding) => ({
          uri: binding.class.value,
          label: binding.label?.value,
          comment: binding.comment?.value,
        })),
      );
    },
    enabled: !!config.url,
  });
};

// Retrieve all data properties for a given class
export const useRdfProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-properties", config.url, classUri, language],
    queryFn: async ({ signal }): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?property ?label ?domain ?range ?order
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status "data property" .
          ?property entedit:order ?order
          ${createSchemaLabelFragment("?property", language)}

          OPTIONAL { ?property rdfs:domain ?domain }
          OPTIONAL { ?property rdfs:range ?range }
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?order ?label ?property
      `;

      const response = await client.query(query, { signal });
      return dedupeByUri(
        response.results.bindings.map((binding) => ({
          uri: binding.property.value,
          label: binding.label?.value,
          comment: binding.comment?.value,
          domain: binding.domain?.value,
          range: binding.range?.value,
          order: binding.order?.value
            ? parseInt(binding.order.value, 10)
            : undefined,
        })),
      );
    },
    enabled: !!config.url,
  });
};

export const useRdfObjectProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-object-properties", config.url, classUri, language],
    queryFn: async ({ signal }): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?property ?label ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "controlled property" || ?status = "object property") .
         ${createSchemaLabelFragment("?property", language)}

          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER(?range != <http://www.w3.org/2004/02/skos/core#Concept> ) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query, { signal });
      return dedupeByUri(
        response.results.bindings.map((binding) => ({
          uri: binding.property.value,
          label: binding.label?.value,
          comment: binding.comment?.value,
          domain: binding.domain?.value,
          range: binding.range?.value,
          status: binding.status?.value,
        })),
      );
    },
    enabled: !!config.url,
  });
};
