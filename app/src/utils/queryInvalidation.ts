import type { QueryClient } from "@tanstack/react-query";

/**
 * Query key roots that represent schema/ontology data, not entity data.
 * These are excluded from invalidateAllEntityData so a user-initiated
 * refresh doesn't pointlessly re-fetch rarely-changing schema queries.
 */
const SCHEMA_QUERY_KEYS = new Set([
  "rdf-classes",
  "rdf-properties",
  "rdf-object-properties",
  "wemi-properties",
  "agent-properties",
  "related-work-properties",
  "related-expression-properties",
  "related-manifestation-properties",
]);

/**
 * Invalidates all entity-related caches (entities, labels, counts, search,
 * exports, manifestations, expressions) while leaving schema caches alone.
 * Used by the header Refresh button to pick up changes made by other users
 * sharing the same database.
 */
export const invalidateAllEntityData = (queryClient: QueryClient): void => {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      return typeof root === "string" && !SCHEMA_QUERY_KEYS.has(root);
    },
  });
};

/**
 * Invalidates all relevant caches after entity mutations
 */
export const invalidateEntityCaches = (
  queryClient: QueryClient,
  endpointUrl: string,
  classUri: string,
  entityUri?: string,
  affectedEntityUris: Set<string> = new Set(),
): void => {
  // Invalidate the entities list for this class (legacy + infinite)
  queryClient.invalidateQueries({
    queryKey: ["entities-by-class", endpointUrl, classUri],
  });
  queryClient.invalidateQueries({
    queryKey: ["entities-by-class-infinite", endpointUrl, classUri],
  });

  // Invalidate entity count caches
  queryClient.invalidateQueries({
    queryKey: ["entity-count-by-class", endpointUrl, classUri],
  });

  // Invalidate entity label queries
  queryClient.invalidateQueries({
    queryKey: ["entity-label", endpointUrl],
  });

  // Invalidate entities-by-range so entity pickers reflect the latest data (legacy + infinite)
  queryClient.invalidateQueries({
    queryKey: ["entities-by-range", endpointUrl],
  });
  queryClient.invalidateQueries({
    queryKey: ["entities-by-range-infinite", endpointUrl],
  });
  queryClient.invalidateQueries({
    queryKey: ["entity-count-by-range", endpointUrl],
  });

  // Invalidate caches for all affected entities (those in relationships)
  affectedEntityUris.forEach((affectedUri) => {
    queryClient.invalidateQueries({
      queryKey: ["entity", endpointUrl, affectedUri],
    });
  });

  // If a specific entity URI is provided, invalidate its cache
  if (entityUri) {
    queryClient.invalidateQueries({
      queryKey: ["entity", endpointUrl, entityUri],
    });
  }
};
