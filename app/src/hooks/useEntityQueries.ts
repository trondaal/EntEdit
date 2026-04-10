import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import {
  createLanguageFallbackFragment,
  getFallbackLanguage,
} from "../utils/sparqlFragments";
import { sanitizeSparqlUri, escapeSparqlLiteral } from "../utils/labelUtils";
import type { SparqlEndpointConfig } from "../types/sparql";

/** Number of entities fetched per page in infinite queries */
export const ENTITIES_PAGE_SIZE = 50;

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

/**
 * Paginated infinite query for entities of a given class.
 * Supports server-side filtering via SPARQL FILTER(CONTAINS(...)).
 * The filter string becomes part of the query key so changing it resets pagination.
 */
export const useInfiniteEntitiesByClass = (
  config: SparqlEndpointConfig,
  classUri: string,
  language: string = "en",
  filter: string = "",
) => {
  return useInfiniteQuery({
    queryKey: [
      "entities-by-class-infinite",
      config.url,
      classUri,
      language,
      filter,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const escapedFilter = filter ? escapeSparqlLiteral(filter.toLowerCase()) : "";
      const filterClause = escapedFilter
        ? `FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))`
        : "";

      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity (SAMPLE(?label) AS ?label)
        WHERE {
          ?entity a <${sanitizeSparqlUri(classUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage)}
          ${filterClause}
        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
        LIMIT ${ENTITIES_PAGE_SIZE}
        OFFSET ${pageParam}
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.entity.value,
        label: binding.label?.value || binding.entity.value,
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // If the last page returned fewer items than page size, there are no more
      if (lastPage.length < ENTITIES_PAGE_SIZE) return undefined;
      return lastPageParam + ENTITIES_PAGE_SIZE;
    },
    enabled: !!config.url && !!classUri,
    placeholderData: (prev) => prev,
  });
};

/**
 * Lightweight COUNT query for total entities in a class, with optional filter.
 * Runs in parallel with the paginated query to provide the "X of Y" display.
 */
export const useEntityCountByClass = (
  config: SparqlEndpointConfig,
  classUri: string,
  language: string = "en",
  filter: string = "",
) => {
  return useQuery({
    queryKey: [
      "entity-count-by-class",
      config.url,
      classUri,
      language,
      filter,
    ],
    queryFn: async () => {
      const client = new SparqlClient(config);

      if (!filter) {
        // No filter: simple count without label resolution
        const query = `
          SELECT (COUNT(DISTINCT ?entity) AS ?count)
          WHERE {
            ?entity a <${sanitizeSparqlUri(classUri)}> .
          }
        `;
        const response = await client.query(query);
        return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
      }

      // With filter: need label resolution to filter on
      const fallbackLanguage = getFallbackLanguage(language);
      const escapedFilter = escapeSparqlLiteral(filter.toLowerCase());
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT (COUNT(DISTINCT ?entity) AS ?count)
        WHERE {
          ?entity a <${sanitizeSparqlUri(classUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage)}
          FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))
        }
      `;
      const response = await client.query(query);
      return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
    },
    enabled: !!config.url && !!classUri,
    placeholderData: (prev) => prev,
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
        FROM <http://www.ontotext.com/explicit>
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

/**
 * Paginated infinite query for entities by range type (used in EntityPickerPanel).
 * Supports server-side filtering.
 */
export const useInfiniteEntitiesByRange = (
  config: SparqlEndpointConfig,
  rangeUri: string,
  language: string = "en",
  filter: string = "",
) => {
  return useInfiniteQuery({
    queryKey: [
      "entities-by-range-infinite",
      config.url,
      rangeUri,
      language,
      filter,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const escapedFilter = filter ? escapeSparqlLiteral(filter.toLowerCase()) : "";
      const filterClause = escapedFilter
        ? `FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))`
        : "";

      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity (SAMPLE(?label) AS ?label)
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?entity a <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false)}
          ${filterClause}
        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
        LIMIT ${ENTITIES_PAGE_SIZE}
        OFFSET ${pageParam}
      `;

      const response = await client.query(query);
      return response.results.bindings.map((binding) => ({
        uri: binding.entity.value,
        label: binding.label?.value || binding.entity.value,
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < ENTITIES_PAGE_SIZE) return undefined;
      return lastPageParam + ENTITIES_PAGE_SIZE;
    },
    enabled: !!config.url && !!rangeUri,
    placeholderData: (prev) => prev,
  });
};

/**
 * COUNT query for entities by range type, with optional filter.
 */
export const useEntityCountByRange = (
  config: SparqlEndpointConfig,
  rangeUri: string,
  language: string = "en",
  filter: string = "",
) => {
  return useQuery({
    queryKey: [
      "entity-count-by-range",
      config.url,
      rangeUri,
      language,
      filter,
    ],
    queryFn: async () => {
      const client = new SparqlClient(config);

      if (!filter) {
        const query = `
          SELECT (COUNT(DISTINCT ?entity) AS ?count)
          WHERE {
            ?entity a <${sanitizeSparqlUri(rangeUri)}> .
          }
        `;
        const response = await client.query(query);
        return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
      }

      const fallbackLanguage = getFallbackLanguage(language);
      const escapedFilter = escapeSparqlLiteral(filter.toLowerCase());
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT (COUNT(DISTINCT ?entity) AS ?count)
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?entity a <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false)}
          FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))
        }
      `;
      const response = await client.query(query);
      return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
    },
    enabled: !!config.url && !!rangeUri,
    placeholderData: (prev) => prev,
  });
};
