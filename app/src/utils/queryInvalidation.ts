import type { QueryClient } from "@tanstack/react-query";

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
  // Invalidate the entities list for this class
  queryClient.invalidateQueries({
    queryKey: ["entities-by-class", endpointUrl, classUri],
  });

  // Invalidate entity label queries
  queryClient.invalidateQueries({
    queryKey: ["entity-label", endpointUrl],
  });

  // Invalidate entities-by-range so entity pickers reflect the latest data
  queryClient.invalidateQueries({
    queryKey: ["entities-by-range", endpointUrl],
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
