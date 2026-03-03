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
