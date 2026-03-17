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
    const baseUrl = `${url.protocol}//${url.host}`;
    const encodedUri = encodeURIComponent(entityUri);
    return `${baseUrl}/graphs-visualizations?uri=${encodedUri}`;
  } catch (error) {
    console.error("Failed to generate graph URL:", error);
    return null;
  }
}
