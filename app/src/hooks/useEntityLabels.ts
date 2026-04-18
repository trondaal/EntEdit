import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "../utils/sparqlClient";
import { getPrimaryLabel, sanitizeSparqlUri } from "../utils/labelUtils";

/**
 * Map from entity URI → best-available rdfs:label for the selected language.
 * Missing URIs are simply absent from the map (callers fall back to a URI
 * fragment for display).
 */
export type EntityLabelsMap = ReadonlyMap<string, string>;

const EMPTY_LABELS: EntityLabelsMap = new Map();

const EntityLabelsContext = createContext<EntityLabelsMap>(EMPTY_LABELS);

export const EntityLabelsProvider = EntityLabelsContext.Provider;

/** Returns the resolved label for a URI, or undefined if not yet loaded. */
export const useEntityLabel = (uri: string | undefined): string | undefined => {
  const map = useContext(EntityLabelsContext);
  if (!uri) return undefined;
  return map.get(uri);
};

/**
 * Batch-fetch rdfs:label for a set of entity URIs in a single SPARQL query.
 *
 * Replaces the previous pattern where each `<ObjectPropertyValue>` fired its
 * own `useQuery` for a single URI (N+1 network requests per entity render).
 * The query key is derived from the sorted + deduplicated URI list so adding
 * or removing values triggers a refetch while identical sets share a cache.
 *
 * Language selection uses the same fallback chain as `getPrimaryLabel`:
 * selected language → untagged → any available.
 */
export function useEntityLabels(
  config: SparqlEndpointConfig,
  uris: readonly string[],
  selectedLanguage: string,
) {
  const sortedUris = useMemo(() => {
    const unique = Array.from(new Set(uris.filter((u) => !!u)));
    unique.sort();
    return unique;
  }, [uris]);

  return useQuery({
    queryKey: [
      "entity-labels-batch",
      config.url,
      selectedLanguage,
      sortedUris,
    ],
    queryFn: async (): Promise<EntityLabelsMap> => {
      if (sortedUris.length === 0) return EMPTY_LABELS;

      const client = new SparqlClient(config);
      const values = sortedUris
        .map((u) => `<${sanitizeSparqlUri(u)}>`)
        .join(" ");

      const query = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        SELECT ?uri ?label ?lang WHERE {
          VALUES ?uri { ${values} }
          ?uri rdfs:label ?label .
          BIND(LANG(?label) AS ?lang)
        }
      `;

      const response = await client.query(query);

      // Group all labels per URI, then pick the best one per language preference.
      const byUri = new Map<
        string,
        Array<{ value: string; language: string }>
      >();
      for (const binding of response.results.bindings) {
        const uri = binding.uri?.value;
        if (!uri) continue;
        const entry = byUri.get(uri);
        const label = {
          value: binding.label.value,
          language: binding.lang?.value ?? "",
        };
        if (entry) {
          entry.push(label);
        } else {
          byUri.set(uri, [label]);
        }
      }

      const result = new Map<string, string>();
      for (const [uri, labels] of byUri) {
        const primary = getPrimaryLabel(labels, selectedLanguage);
        if (primary) result.set(uri, primary);
      }
      return result;
    },
    enabled: !!config.url && sortedUris.length > 0,
    placeholderData: (prev) => prev,
  });
}
