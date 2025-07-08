import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
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

        SELECT DISTINCT ?class ?label ?comment
        WHERE {
          ?class a owl:Class .
          ?class entedit:status "class" .
          OPTIONAL {
            ?class rdfs:label ?label .
            FILTER(LANG(?label) = "${language}" || LANG(?label) = "")
          }
          OPTIONAL {
            ?class rdfs:comment ?comment .
            FILTER(LANG(?comment) = "${language}" || LANG(?comment) = "")
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

export const useRdfProperties = (
  config: SparqlEndpointConfig,
  classUri?: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["rdf-properties", config.url, classUri, language],
    queryFn: async (): Promise<RdfProperty[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?property ?label ?comment ?domain ?range
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status "data property" .
          OPTIONAL {
            ?property rdfs:label ?label .
            FILTER(LANG(?label) = "${language}" || LANG(?label) = "")
          }
          OPTIONAL {
            ?property rdfs:comment ?comment .
            FILTER(LANG(?comment) = "${language}" || LANG(?comment) = "")
          }
          OPTIONAL { ?property rdfs:domain ?domain }
          OPTIONAL { ?property rdfs:range ?range }
          ${classUri ? `FILTER(?domain = <${classUri}>)` : ""}
        }
        ORDER BY ?property
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.property.value,
        label: binding.label?.value,
        comment: binding.comment?.value,
        domain: binding.domain?.value,
        range: binding.range?.value,
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
      const query = `
        SELECT DISTINCT ?entity (SAMPLE(?label) AS ?label)
        WHERE {
          ?entity a <${classUri}> .
          OPTIONAL { ?entity rdfs:label ?label .
          FILTER(LANG(?label) = "${language}" || LANG(?label) = "") .}
        }GROUP BY ?entity
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
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX entedit: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?property ?label ?comment ?domain ?range ?status
        WHERE {
          ?property a rdf:Property .
          ?property entedit:status ?status.
          FILTER(?status = "controlled property" || ?status = "object property") .
          OPTIONAL {
            ?property rdfs:label ?label .
            FILTER(LANG(?label) = "${language}" || LANG(?label) = "")
          }
          OPTIONAL {
            ?property rdfs:comment ?comment .
            FILTER(LANG(?comment) = "${language}" || LANG(?comment) = "")
          }
          ?property rdfs:domain ?domain .
          ?property rdfs:range ?range .
    	    FILTER($range != <http://www.w3.org/2004/02/skos/core#Concept> ) .
          ${classUri ? `FILTER(?domain = <${classUri}>)` : ""}
        }
        ORDER BY ?label
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
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity ?label
        WHERE {
          ?entity a <${rangeUri}> .
          OPTIONAL {
            ?entity rdfs:label ?label .
            FILTER(LANG(?label) = "${language}" || LANG(?label) = "")
          }
        }
        ORDER BY ?label ?entity
        LIMIT 1000
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.entity.value,
        label: binding.label?.value || binding.entity.value,
      }));
    },
    enabled: !!config.url && !!rangeUri,
  });
};

export const useAvailableLanguages = (config: SparqlEndpointConfig) => {
  return useQuery({
    queryKey: ["available-languages", config.url],
    queryFn: async (): Promise<string[]> => {
      const client = new SparqlClient(config);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?lang
        WHERE {
          ?s rdfs:label ?label .
          BIND(LANG(?label) AS ?lang)
          FILTER(?lang != "")
        }
        ORDER BY ?lang
      `;

      const response = await client.query(query);
      const languages = response.results.bindings
        .map((binding) => binding.lang.value)
        .filter((lang) => lang !== "");

      // Ensure 'en' is always available and first
      const uniqueLanguages = Array.from(new Set(languages));
      if (!uniqueLanguages.includes("en")) {
        uniqueLanguages.unshift("en");
      } else {
        uniqueLanguages.sort((a, b) => {
          if (a === "en") return -1;
          if (b === "en") return 1;
          return a.localeCompare(b);
        });
      }

      return uniqueLanguages;
    },
    enabled: !!config.url,
  });
};
