import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  buildManifestationDetailQuery,
  manifestationsOfExpression,
  toManifestationDetail,
} from "../utils/wemiQueries";

export interface Manifestation {
  uri: string;
  // Line 1: Title area
  title?: string;                    // rdamd:P30156
  numbering?: string;                // rdamd:P30014
  other?: string;                    // rdamd:P30142
  responsibilityStatement?: string;  // rdamd:P30117
  // Line 2: Publication area
  edition?: string;                  // rdamd:P30107
  place?: string;                    // rdamd:P30088
  publisher?: string;                // rdamd:P30076
  date?: string;                     // rdamd:P30011
  // Line 3: Physical description
  extent?: string;                   // rdamd:P30182
  dimensions?: string;               // rdamd:P30169
  // Line 4: Series
  series?: string;                   // rdamd:P30106
  seriesNumbering?: string;          // rdamd:P30165
  // Line 5: Notes (concatenated)
  notes?: string;                    // rdamd:P30137 - GROUP_CONCAT
  // Line 6: Identifiers (concatenated)
  identifiers?: string;              // rdamd:P30004 - GROUP_CONCAT
  // Additional metadata
  mediatype?: string;
  mediatypeUri?: string;
  carriertype?: string;
  carriertypeUri?: string;
  // Agents
  manifestation_creators?: string;
}

export const useManifestations = (
  config: SparqlEndpointConfig,
  expressionUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: ["manifestations", config.url, expressionUri, language],
    queryFn: async ({ signal }): Promise<Manifestation[]> => {
      if (!expressionUri) {
        return [];
      }

      const client = new SparqlClient(config);
      const response = await client.query(
        buildManifestationDetailQuery(manifestationsOfExpression(expressionUri), language),
        { signal },
      );
      return response.results.bindings.map(toManifestationDetail);
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
