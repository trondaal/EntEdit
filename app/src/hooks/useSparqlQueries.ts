import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import {
  createLanguageFallbackFragment,
  getFallbackLanguage,
} from "../utils/sparqlFragments";
import { sanitizeSparqlUri, escapeSparqlLiteral } from "../utils/labelUtils";
import type {
  SparqlEndpointConfig,
  RdfClass,
  RdfProperty,
} from "../types/sparql";

export const useRdfClasses = (
  config: SparqlEndpointConfig,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-classes", config.url, language],
    queryFn: async (): Promise<RdfClass[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?class ?label
        WHERE {
          ?class a owl:Class .
          ?class entedit:status "class" .
          OPTIONAL {
            ?class rdfs:label ?label .
            FILTER(LANG(?label) = "${escapeSparqlLiteral(language)}" || LANG(?label) = "")
          }
        }
        ORDER BY desc(?label)
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.class.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
      }));
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
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
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
          ${createLanguageFallbackFragment("?property", language, fallbackLanguage)}

          OPTIONAL { ?property rdfs:domain ?domain }
          OPTIONAL { ?property rdfs:range ?range }
          ${classUri ? `FILTER(?domain = <${sanitizeSparqlUri(classUri)}>)` : ""}
        }
        ORDER BY ?order ?label ?property
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
        order: binding.order?.value ? parseInt(binding.order.value, 10) : undefined,
      }));
    },
    enabled: !!config.url,
  });
};

export const useEntitiesByClass = (
  config: SparqlEndpointConfig,
  classUri: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["entities-by-class", config.url, classUri, language],
    queryFn: async () => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity (SAMPLE(?label) AS ?label)
        WHERE {
          ?entity a <${sanitizeSparqlUri(classUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage)}

        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.entity.value,
        label: binding.label?.value || binding.entity.value,
      }));
    },
    enabled: !!config.url && !!classUri,
  });
};

export const useRdfObjectProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-object-properties", config.url, classUri, language],
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
    	    FILTER(?range != <http://www.w3.org/2004/02/skos/core#Concept> ) .
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

export const useEntitiesByRange = (
  config: SparqlEndpointConfig,
  rangeUri: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["entities-by-range", config.url, rangeUri, language],
    queryFn: async () => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity ?label
        WHERE {
          ?entity a <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false)}

        }
        ORDER BY STR(?label) ?entity
      `;

      const response = await client.query(query);
      const seen = new Set<string>();
      return response.results.bindings
        .map((binding) => ({
          uri: binding.entity.value,
          label: binding.label?.value || binding.entity.value,
        }))
        .filter((entity) => {
          if (seen.has(entity.uri)) return false;
          seen.add(entity.uri);
          return true;
        });
    },
    enabled: !!config.url && !!rangeUri,
  });
};

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

