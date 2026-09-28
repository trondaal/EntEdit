/**
 * URL of a GraphDB Workbench page (e.g. "graphs" for Graphs overview),
 * derived from the SPARQL endpoint URL.
 */
export function getWorkbenchUrl(endpointUrl: string, page: string): string | null {
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
    return `${url.origin}${basePath}/${page}`;
  } catch (error) {
    console.error("Failed to generate Workbench URL:", error);
    return null;
  }
}

/** GraphDB Workbench visualization URL for an entity. */
export function getGraphVisualizationUrl(
  endpointUrl: string,
  entityUri: string
): string | null {
  return getWorkbenchUrl(endpointUrl, `graphs-visualizations?uri=${encodeURIComponent(entityUri)}`);
}

/**
 * Extracts the repository id from a SPARQL endpoint URL (.../repositories/<id>),
 * or null if the URL has no repository segment.
 */
export function getWorkbenchRepositoryId(endpointUrl: string): string | null {
  try {
    const { pathname } = new URL(endpointUrl);
    const match = pathname.match(/\/repositories\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The Workbench renders a visualization only once a repository is connected, and
 * remembers that choice in its own localStorage under `ls.repository-id`. Until
 * the user has picked one by hand, a visualization link lands on the repository
 * chooser instead of the graph.
 *
 * When GraphDB is proxied under the same origin as this app, its localStorage is
 * also ours, so the choice can be seeded from the configured endpoint and the
 * link works on first click. A cross-origin deployment (GraphDB on its own port)
 * cannot be seeded — there the user selects the repository once in the Workbench.
 */
export function prepareWorkbenchRepository(endpointUrl: string): void {
  try {
    const url = new URL(endpointUrl, window.location.href);
    if (url.origin !== window.location.origin) return;

    const repositoryId = getWorkbenchRepositoryId(endpointUrl);
    if (!repositoryId) return;

    localStorage.setItem("ls.repository-id", repositoryId);
    localStorage.setItem("ls.repository-location", "");
  } catch {
    // Storage can be unavailable (private browsing, blocked site data). The link
    // still opens; the user just picks the repository in the Workbench.
  }
}

/**
 * Seeds the Workbench repository, then opens Graphs overview in a new tab,
 * where "Export repository" exports everything (Turtle*, TriG* keep RDF-star).
 */
export function openWorkbenchExport(endpointUrl: string): void {
  const url = getWorkbenchUrl(endpointUrl, "graphs");
  if (!url) return;
  prepareWorkbenchRepository(endpointUrl);
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Seeds the Workbench repository, then opens the visualization in a new tab. */
export function openGraphVisualization(endpointUrl: string, entityUri: string): void {
  const url = getGraphVisualizationUrl(endpointUrl, entityUri);
  if (!url) return;
  prepareWorkbenchRepository(endpointUrl);
  window.open(url, "_blank", "noopener,noreferrer");
}
