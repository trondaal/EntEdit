import { sanitizeSparqlUri } from "./labelUtils";

/** The named graph new entities are written to, unless the user chose another. */
export const DEFAULT_DATA_GRAPH = "http://entedit.org/data";

/** An absolute IRI that is safe to put in a query. */
export const isUsableGraphIri = (value: string): boolean => {
  const iri = value.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/.test(iri)) return false;
  try {
    sanitizeSparqlUri(iri);
    return true;
  } catch {
    return false;
  }
};

/** Empty means "use the default"; anything else has to be a usable IRI. */
export const isGraphSettingInvalid = (value: string): boolean =>
  value.trim() !== "" && !isUsableGraphIri(value);

/** The graph new data goes to for this endpoint: the setting, else the default. */
export const dataGraphOf = (config?: { dataGraph?: string }): string => {
  const chosen = config?.dataGraph?.trim();
  return chosen && isUsableGraphIri(chosen) ? chosen : DEFAULT_DATA_GRAPH;
};

/**
 * The graph for the triples a save inserts. An existing entity stays in the
 * graph it was loaded from (undefined: the default graph, as in a repository
 * from before the data graph existed); a new one has no graph yet.
 */
export const graphForSave = (
  isNewEntity: boolean,
  loadedGraph: string | undefined,
  dataGraph: string,
): string | undefined => (isNewEntity ? dataGraph : loadedGraph);
