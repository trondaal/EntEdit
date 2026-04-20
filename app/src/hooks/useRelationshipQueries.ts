import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { createSchemaLabelFragment } from "../utils/sparqlFragments";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import type { SparqlEndpointConfig, RdfProperty } from "../types/sparql";

/**
 * Properties excluded from the related-Work/Expression/Manifestation sections
 * because they are surfaced by the dedicated WEMI section instead.
 */
const RELATED_EXCLUDED_PROPERTIES = [
  "rdawo:P10078",
  "rdaeo:P20231",
  "rdaeo:P20059",
  "rdamo:P30135",
  "rdamo:P30139",
].join(",");

/** Defensive URI-based dedup — mirrors the helper in useSchemaQueries. */
function dedupeByUri<T extends { uri: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.uri)) seen.set(item.uri, item);
  }
  return [...seen.values()];
}

/**
 * Shared implementation for the related-Work / related-Expression /
 * related-Manifestation property hooks. They differ only by RDA class URI
 * (C10001 / C10006 / C10007) and their query-key root (so cache entries
 * stay independent). Each thin wrapper below passes in its specific values.
 */
function useRelatedPropertiesByRange(
  config: SparqlEndpointConfig,
  classUri: string | undefined,
  language: string,
  queryKeyRoot: string,
  rangeUri: string,
) {
  return useQuery({
    queryKey: [queryKeyRoot, config.url, classUri, language],
    queryFn: async ({ signal }): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>

        SELECT DISTINCT ?property ?label ?domain ?range ?status ?order
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "object property") .
          ${createSchemaLabelFragment("?property", language)}

          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
          OPTIONAL { ?property entedit:order ?order }
          FILTER(?range = <${sanitizeSparqlUri(rangeUri)}>) .
          FILTER(?property NOT IN (${RELATED_EXCLUDED_PROPERTIES})) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range asc(?order) STR(?label)
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
}

// Hook for Basic WEMI relationship properties
export const useWEMIProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["wemi-properties", config.url, classUri, language],
    queryFn: async ({ signal }): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>


        SELECT DISTINCT ?property ?label ?domain ?range ?status ?order
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "core wemi property") .
          ${createSchemaLabelFragment("?property", language)}
          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
          OPTIONAL { ?property entedit:order ?order }

          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY asc(?order) ?range STR(?label)
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

// Hook for Related Agent properties
export const useAgentProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["agent-properties", config.url, classUri, language],
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
    	    FILTER(?range = <http://rdaregistry.info/Elements/c/C10002> ) .
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

// Hook for Related Work properties
export const useRelatedWorkProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) =>
  useRelatedPropertiesByRange(
    config,
    classUri,
    language,
    "related-work-properties",
    "http://rdaregistry.info/Elements/c/C10001",
  );

// Hook for Related Expression properties
export const useRelatedExpressionProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) =>
  useRelatedPropertiesByRange(
    config,
    classUri,
    language,
    "related-expression-properties",
    "http://rdaregistry.info/Elements/c/C10006",
  );

// Hook for Related Manifestation properties
export const useRelatedManifestationProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) =>
  useRelatedPropertiesByRange(
    config,
    classUri,
    language,
    "related-manifestation-properties",
    "http://rdaregistry.info/Elements/c/C10007",
  );
