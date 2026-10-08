import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import {
  createLanguageFallbackFragment,
  getFallbackLanguage,
} from "../utils/sparqlFragments";
import { sanitizeSparqlUri, escapeSparqlLiteral } from "../utils/labelUtils";
import { termFromBinding, termKey } from "../utils/rdfTerms";
import {
  ENTITY_INDEX_STATUS_QUERY,
  buildEntityCountQuery,
  buildEntityPageQuery,
  buildPageLabelsQuery,
  isBuilt,
  isIndexedClass,
  withLabels,
  type ListedEntity,
} from "../utils/entityList";
import type { StoredTerm } from "../utils/entityUpdate";
import type { SparqlEndpointConfig, OrderedValue } from "../types/sparql";

/** Number of entities fetched per page in infinite queries */
export const ENTITIES_PAGE_SIZE = 50;

/** A language-tagged rdfs:label loaded from the entity. */
export interface EntityLabel {
  id: string;
  value: string;
  language: string;
}

/** Shape returned by `useEntityQuery` — all outgoing triples grouped by property,
 * plus rdfs:label entries separated out for the LabelManager, plus the
 * explicit snapshot the save path diffs against. */
export interface LoadedEntity {
  data: Record<string, OrderedValue[]>;
  labels: EntityLabel[];
  /** Every explicitly asserted triple, with its term details and named graph. */
  snapshot: StoredTerm[];
  /** Graph holding the entity's rdf:type, i.e. where new triples belong. */
  targetGraph?: string;
}

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/** Explicit triples of one entity: full terms, their graph and value order. */
const EXPLICIT_QUERY = (uri: string) => `
        PREFIX entedit: <http://oslomet.no/abi/vocab#>
        SELECT DISTINCT ?property ?value ?valueOrder ?graph WHERE {
          <${uri}> ?property ?value .
          OPTIONAL { GRAPH ?graph { <${uri}> ?property ?value . } }
          OPTIONAL {
            << <${uri}> ?property ?value >> entedit:valueOrder ?valueOrder .
          }
        }
        ORDER BY ?property ?valueOrder
      `;

/** Reads the explicit triples of an entity as a diffable snapshot. */
export const loadEntitySnapshot = async (
  client: SparqlClient,
  entityUri: string,
  signal?: AbortSignal,
): Promise<StoredTerm[]> => {
  const response = await client.queryWithoutInference(
    EXPLICIT_QUERY(sanitizeSparqlUri(entityUri)),
    { signal },
  );
  return response.results.bindings.map((binding) => ({
    property: binding.property.value,
    ...termFromBinding(binding.value),
    graph: binding.graph?.value,
    order: binding.valueOrder?.value
      ? parseInt(binding.valueOrder.value, 10)
      : undefined,
  }));
};

/**
 * Loads one entity for the editor.
 *
 * Two queries are run: the explicit triples (the snapshot the save path
 * diffs against, carrying language tags, datatypes and named graphs) and the
 * inferred view. Statements that exist only through inference are marked
 * `inferred` so the editor can show them read-only instead of writing them
 * back as asserted triples.
 */
export const useEntityQuery = (
  config: SparqlEndpointConfig,
  entityUri: string | null,
) => {
  return useQuery({
    queryKey: ["entity", config.url, entityUri],
    queryFn: async ({ signal }): Promise<LoadedEntity | null> => {
      if (!entityUri) return null;

      const client = new SparqlClient(config);
      const sanitizedUri = sanitizeSparqlUri(entityUri);
      const inferredQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT DISTINCT ?property ?value WHERE {
          <${sanitizedUri}> ?property ?value .
          FILTER NOT EXISTS {
            <${sanitizedUri}> ?subProperty ?value .
            ?subProperty rdfs:subPropertyOf+ ?property .
            FILTER (?subProperty != ?property)
          }
        }
        ORDER BY ?property
      `;

      const [snapshot, inferredResponse] = await Promise.all([
        loadEntitySnapshot(client, entityUri, signal),
        client.query(inferredQuery, { signal }),
      ]);

      const data: Record<string, OrderedValue[]> = {};
      const labels: EntityLabel[] = [];
      const explicitKeys = new Set(
        snapshot.map((term) => `${term.property}\u0000${termKey(term)}`),
      );

      const push = (
        property: string,
        term: OrderedValue & { inferred?: boolean },
      ) => {
        if (!data[property]) data[property] = [];
        data[property].push(term);
      };

      // Explicit triples first, in their stored order
      for (const term of snapshot) {
        if (term.property === RDFS_LABEL) {
          labels.push({
            id: `label-${labels.length}`,
            value: term.value,
            language: term.lang ?? "",
          });
          continue;
        }
        push(term.property, {
          value: term.value,
          order: term.order ?? (data[term.property]?.length ?? 0),
          isUri: term.isUri,
          lang: term.lang,
          datatype: term.datatype,
        });
      }

      // Then whatever only the reasoner knows about, read-only
      for (const binding of inferredResponse.results.bindings) {
        const property = binding.property.value;
        const term = termFromBinding(binding.value);
        if (explicitKeys.has(`${property}\u0000${termKey(term)}`)) continue;
        if (property === RDFS_LABEL) continue;
        push(property, {
          ...term,
          order: data[property]?.length ?? 0,
          inferred: true,
        });
      }

      // Keep values in order, with the editable ones first
      Object.values(data).forEach((values) => {
        values.sort((a, b) => {
          if (!!a.inferred !== !!b.inferred) return a.inferred ? 1 : -1;
          return a.order - b.order;
        });
        values.forEach((value, index) => {
          value.order = index;
        });
      });

      const targetGraph = snapshot.find(
        (term) => term.property === RDF_TYPE && term.graph,
      )?.graph;

      return { data, labels, snapshot, targetGraph };
    },
    enabled: !!entityUri && !!config.url,
  });
};

/**
 * Whether the repository has the `entitiesIndex` connector (see
 * `utils/entityList.ts`). Without it the lists fall back to sorting in
 * SPARQL, which is correct but slow on a large repository. Failing to ask
 * counts as "no index".
 */
export const useEntityIndexAvailable = (config: SparqlEndpointConfig) =>
  useQuery({
    queryKey: ["entity-index-available", config.url],
    queryFn: async ({ signal }) => {
      try {
        const response = await new SparqlClient(config).query(ENTITY_INDEX_STATUS_QUERY, { signal });
        return isBuilt(response.results.bindings[0]?.status?.value);
      } catch {
        return false;
      }
    },
    enabled: !!config.url,
    staleTime: 5 * 60 * 1000,
  });

/** One page of a class's entities from the index: its order, the labels of the chosen language. */
const fetchIndexedPage = async (
  client: SparqlClient,
  classUri: string,
  language: string,
  filter: string,
  offset: number,
  signal?: AbortSignal,
): Promise<ListedEntity[]> => {
  const hits = await client.query(
    buildEntityPageQuery(classUri, filter, ENTITIES_PAGE_SIZE, offset),
    { signal },
  );
  const uris = hits.results.bindings.map((binding) => binding.entity.value);
  if (uris.length === 0) return [];
  const labelRows = await client.query(buildPageLabelsQuery(uris, language), { signal });
  const labels = new Map<string, string>();
  for (const binding of labelRows.results.bindings) {
    if (binding.label?.value) labels.set(binding.entity.value, binding.label.value);
  }
  return withLabels(uris, labels);
};

const fetchIndexedCount = async (
  client: SparqlClient,
  classUri: string,
  filter: string,
  signal?: AbortSignal,
): Promise<number> => {
  const response = await client.query(buildEntityCountQuery(classUri, filter), { signal });
  return parseInt(response.results.bindings[0]?.total?.value || "0", 10);
};

export const useEntitiesByClass = (
  config: SparqlEndpointConfig,
  classUri: string,
  language: string = "en",
) => {
  return useQuery({
    queryKey: ["entities-by-class", config.url, classUri, language],
    queryFn: async ({ signal }) => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity (SAMPLE(?label) AS ?label)
        WHERE {
          ?entity a <${sanitizeSparqlUri(classUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", true, true)}

        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
      `;

      const response = await client.query(query, { signal });
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
  const available = useEntityIndexAvailable(config).data;
  const indexed = available === true && isIndexedClass(classUri);
  return useInfiniteQuery({
    queryKey: [
      "entities-by-class-infinite",
      config.url,
      classUri,
      language,
      filter,
      indexed,
    ],
    queryFn: async ({ pageParam = 0, signal }) => {
      const client = new SparqlClient(config);
      if (indexed) {
        return fetchIndexedPage(client, classUri, language, filter, pageParam, signal);
      }
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
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", true, true)}
          ${filterClause}
        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
        LIMIT ${ENTITIES_PAGE_SIZE}
        OFFSET ${pageParam}
      `;

      const response = await client.query(query, { signal });
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
    enabled: !!config.url && !!classUri && available !== undefined,
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
  const available = useEntityIndexAvailable(config).data;
  const indexed = available === true && isIndexedClass(classUri);
  return useQuery({
    queryKey: [
      "entity-count-by-class",
      config.url,
      classUri,
      language,
      filter,
      indexed,
    ],
    queryFn: async ({ signal }) => {
      const client = new SparqlClient(config);
      if (indexed) return fetchIndexedCount(client, classUri, filter, signal);

      if (!filter) {
        // No filter: simple count without label resolution
        const query = `
          SELECT (COUNT(DISTINCT ?entity) AS ?count)
          WHERE {
            ?entity a <${sanitizeSparqlUri(classUri)}> .
          }
        `;
        const response = await client.query(query, { signal });
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
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", true, true)}
          FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))
        }
      `;
      const response = await client.query(query, { signal });
      return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
    },
    enabled: !!config.url && !!classUri && available !== undefined,
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
    queryFn: async ({ signal }) => {
      const client = new SparqlClient(config);
      const fallbackLanguage = getFallbackLanguage(language);
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity ?label
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?entity a ?type .
          ?type rdfs:subClassOf* <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false, true)}

        }
        ORDER BY STR(?label) ?entity
      `;

      const response = await client.query(query, { signal });
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
  const available = useEntityIndexAvailable(config).data;
  const indexed = available === true && isIndexedClass(rangeUri);
  return useInfiniteQuery({
    queryKey: [
      "entities-by-range-infinite",
      config.url,
      rangeUri,
      language,
      filter,
      indexed,
    ],
    queryFn: async ({ pageParam = 0, signal }) => {
      const client = new SparqlClient(config);
      if (indexed) {
        return fetchIndexedPage(client, rangeUri, language, filter, pageParam, signal);
      }
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
          ?entity a ?type .
          ?type rdfs:subClassOf* <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false, true)}
          ${filterClause}
        }
        GROUP BY ?entity
        ORDER BY ?label ?entity
        LIMIT ${ENTITIES_PAGE_SIZE}
        OFFSET ${pageParam}
      `;

      const response = await client.query(query, { signal });
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
    enabled: !!config.url && !!rangeUri && available !== undefined,
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
  const available = useEntityIndexAvailable(config).data;
  const indexed = available === true && isIndexedClass(rangeUri);
  return useQuery({
    queryKey: [
      "entity-count-by-range",
      config.url,
      rangeUri,
      language,
      filter,
      indexed,
    ],
    queryFn: async ({ signal }) => {
      const client = new SparqlClient(config);
      if (indexed) return fetchIndexedCount(client, rangeUri, filter, signal);

      if (!filter) {
        const query = `
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

          SELECT (COUNT(DISTINCT ?entity) AS ?count)
          FROM <http://www.ontotext.com/explicit>
          WHERE {
            ?entity a ?type .
            ?type rdfs:subClassOf* <${sanitizeSparqlUri(rangeUri)}> .
          }
        `;
        const response = await client.query(query, { signal });
        return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
      }

      const fallbackLanguage = getFallbackLanguage(language);
      const escapedFilter = escapeSparqlLiteral(filter.toLowerCase());
      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT (COUNT(DISTINCT ?entity) AS ?count)
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          ?entity a ?type .
          ?type rdfs:subClassOf* <${sanitizeSparqlUri(rangeUri)}> .
${createLanguageFallbackFragment("?entity", language, fallbackLanguage, "label", false, true)}
          FILTER(CONTAINS(LCASE(STR(?label)), "${escapedFilter}"))
        }
      `;
      const response = await client.query(query, { signal });
      return parseInt(response.results.bindings[0]?.count?.value || "0", 10);
    },
    enabled: !!config.url && !!rangeUri && available !== undefined,
    placeholderData: (prev) => prev,
  });
};
