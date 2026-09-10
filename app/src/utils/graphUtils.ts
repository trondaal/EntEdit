/**
 * Generates a GraphDB Workbench visualization URL for an entity.
 * Derives the base URL from the SPARQL endpoint URL and appends
 * the graphs-visualizations path with the entity URI as a query parameter.
 */
export function getGraphVisualizationUrl(
  endpointUrl: string,
  entityUri: string
): string | null {
  try {
    const url = new URL(endpointUrl);
    // The Workbench lives at the GraphDB root, which is the endpoint URL with the
    // trailing /repositories/<id> removed. Deriving it that way keeps the link
    // correct for every deployment: GraphDB on its own port, or behind a reverse
    // proxy on any path, where the Workbench is served through the same proxy
    // rather than on a port of its own.
    const basePath = url.pathname
      .replace(/\/repositories\/[^/]+\/?$/, "")
      .replace(/\/$/, "");
    const encodedUri = encodeURIComponent(entityUri);
    return `${url.origin}${basePath}/graphs-visualizations?uri=${encodedUri}`;
  } catch (error) {
    console.error("Failed to generate graph URL:", error);
    return null;
  }
}
