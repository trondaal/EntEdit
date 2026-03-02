import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import { sanitizeSparqlUri } from "../utils/labelUtils";

export interface Manifestation {
  uri: string;
  // Line 1: Title area
  title?: string;                    // rdamd:P30156
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
  carriertype?: string;
}

export const useManifestations = (
  config: SparqlEndpointConfig,
  expressionUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: ["manifestations", config.url, expressionUri, language],
    queryFn: async (): Promise<Manifestation[]> => {
      if (!expressionUri) {
        return [];
      }

      const client = new SparqlClient(config);

      const sparqlQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdaed: <http://rdaregistry.info/Elements/e/datatype/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdamd: <http://rdaregistry.info/Elements/m/datatype/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>

        SELECT DISTINCT ?manifestation
               (SAMPLE(?title_val) as ?title)
               (SAMPLE(?other_val) as ?other)
               (SAMPLE(?responsibilityStatement_val) as ?responsibilityStatement)
               (SAMPLE(?edition_val) as ?edition)
               (SAMPLE(?place_val) as ?place)
               (SAMPLE(?publisher_val) as ?publisher)
               (SAMPLE(?date_val) as ?date)
               (SAMPLE(?extent_val) as ?extent)
               (SAMPLE(?dimensions_val) as ?dimensions)
               (SAMPLE(?series_val) as ?series)
               (SAMPLE(?seriesNumbering_val) as ?seriesNumbering)
               (GROUP_CONCAT(DISTINCT ?note_val; SEPARATOR=" | ") as ?notes)
               (GROUP_CONCAT(DISTINCT ?identifier_val; SEPARATOR=" | ") as ?identifiers)
               (SAMPLE(?mediatypelabel) as ?mediatypelabel)
               (SAMPLE(?carriertypelabel) as ?carriertypelabel)
        WHERE {
          <${sanitizeSparqlUri(expressionUri)}> rdaeo:P20059 ?manifestation .
          # Title area
          OPTIONAL {
            ?manifestation rdamd:P30156 ?title_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30142 ?other_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30117 ?responsibilityStatement_val .
          }
          # Publication area
          OPTIONAL {
            ?manifestation rdamd:P30107 ?edition_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30088 ?place_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30076 ?publisher_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30011 ?date_val .
          }
          # Physical description
          OPTIONAL {
            ?manifestation rdamd:P30182 ?extent_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30169 ?dimensions_val .
          }
          # Series
          OPTIONAL {
            ?manifestation rdamd:P30106 ?series_val .
          }
          OPTIONAL {
            ?manifestation rdamd:P30165 ?seriesNumbering_val .
          }
          # Notes (multiple values)
          OPTIONAL {
            ?manifestation rdamd:P30137 ?note_val .
          }
          # Identifiers (multiple values)
          OPTIONAL {
            ?manifestation rdamd:P30004 ?identifier_val .
          }
          #mediatype label, we use english as default
          OPTIONAL {
              ?manifestation rdamo:P30002 ?mediatype_chosen .
              ?mediatype_chosen rdfs:label ?mediatypelabel_chosen .
              FILTER(LANG(?mediatypelabel_chosen) = "${language}")
          }
          OPTIONAL {
              ?manifestation rdamo:P30002 ?mediatype_en .
              ?mediatype_en rdfs:label ?mediatypelabel_en .
              FILTER(LANG(?mediatypelabel_en) = "en")
          }
          BIND(COALESCE(?mediatypelabel_chosen, ?mediatypelabel_en) AS ?mediatypelabel)
           #carriertype label, we use english as default
          OPTIONAL {
              ?manifestation rdamo:P30001  ?carriertype_chosen .
              ?carriertype_chosen rdfs:label ?carriertypelabel_chosen .
              FILTER(LANG(?carriertypelabel_chosen) = "${language}")
          }
          OPTIONAL {
              ?manifestation rdamo:P30001 ?carriertype_en .
              ?carriertype_en rdfs:label ?carriertypelabel_en .
              FILTER(LANG(?carriertypelabel_en) = "en")
          }
          BIND(COALESCE(?carriertypelabel_chosen, ?carriertypelabel_en) AS ?carriertypelabel)
        }
        GROUP BY ?manifestation
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.manifestation.value,
        title: binding.title?.value,
        other: binding.other?.value,
        responsibilityStatement: binding.responsibilityStatement?.value,
        edition: binding.edition?.value,
        place: binding.place?.value,
        publisher: binding.publisher?.value,
        date: binding.date?.value,
        extent: binding.extent?.value,
        dimensions: binding.dimensions?.value,
        series: binding.series?.value,
        seriesNumbering: binding.seriesNumbering?.value,
        notes: binding.notes?.value,
        identifiers: binding.identifiers?.value,
        mediatype: binding.mediatypelabel?.value,
        carriertype: binding.carriertypelabel?.value,
      }));
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
