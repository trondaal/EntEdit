import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import {
  createLanguageFallbackFragment,
  getFallbackLanguage,
} from "../utils/sparqlFragments";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import type {
  SparqlEndpointConfig,
  RdfProperty,
} from "../types/sparql";

// Hook for Basic WEMI relationship properties
export const useWEMIProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["wemi-properties", config.url, classUri, language],
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>


        SELECT DISTINCT ?property ?label ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "core wemi property") .
          ${createLanguageFallbackFragment("?property", language, fallbackLanguage)}
          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .

          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        status: binding.status?.value,
      }));
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
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
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
          ${createLanguageFallbackFragment("?property", language, fallbackLanguage)}
          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER(?range = <http://rdaregistry.info/Elements/c/C10002> ) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        status: binding.status?.value,
      }));
    },
    enabled: !!config.url,
  });
};

// Hook for Related Work properties
export const useRelatedWorkProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["related-work-properties", config.url, classUri, language],
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>

        SELECT DISTINCT ?property ?label ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "object property") .
          ${createLanguageFallbackFragment("?property", language, fallbackLanguage)}

          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER(?range = <http://rdaregistry.info/Elements/c/C10001> ) .
          FILTER(?property NOT IN (rdawo:P10078,rdaeo:P20231,rdaeo:P20059,rdamo:P30135,rdamo:P30139)) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        status: binding.status?.value,
      }));
    },
    enabled: !!config.url,
  });
};

// Hook for Related Expression properties
export const useRelatedExpressionProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["related-expression-properties", config.url, classUri, language],
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>

        SELECT DISTINCT ?property ?label ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "object property") .
${createLanguageFallbackFragment("?property", language, fallbackLanguage)}

          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER(?range = <http://rdaregistry.info/Elements/c/C10006> ) .
          FILTER(?property NOT IN (rdawo:P10078,rdaeo:P20231,rdaeo:P20059,rdamo:P30135,rdamo:P30139)) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        status: binding.status?.value,
      }));
    },
    enabled: !!config.url,
  });
};

// Hook for Related Manifestation properties
export const useRelatedManifestationProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["related-manifestation-properties", config.url, classUri, language],
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>

        SELECT DISTINCT ?property ?label ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "object property") .
${createLanguageFallbackFragment("?property", language, fallbackLanguage)}

          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER(?range = <http://rdaregistry.info/Elements/c/C10007>) .
          FILTER(?property NOT IN (rdawo:P10078,rdaeo:P20231,rdaeo:P20059,rdamo:P30135,rdamo:P30139)) .
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?range STR(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        status: binding.status?.value,
      }));
    },
    enabled: !!config.url,
  });
};
