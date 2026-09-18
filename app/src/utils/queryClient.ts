import { QueryClient } from '@tanstack/react-query';
import { SparqlError } from './sparqlClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Only network failures are worth retrying: an auth error or a query
      // the server rejected (4xx/5xx) fails the same way every time.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        (!(error instanceof SparqlError) || error.code === "network"),
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
    },
  },
});