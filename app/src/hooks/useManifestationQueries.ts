import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import { sanitizeSparqlUri, escapeSparqlLiteral } from "../utils/labelUtils";
import { SPARQL_SEP } from "../utils/textFormatters";

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
    queryFn: async (): Promise<Manifestation[]> => {
      if (!expressionUri) {
        return [];
      }

      const client = new SparqlClient(config);

      const sparqlQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
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
               (SAMPLE(?mediatype_uri_val) as ?mediatype_uri)
               (SAMPLE(?carriertypelabel) as ?carriertypelabel)
               (SAMPLE(?carriertype_uri_val) as ?carriertype_uri)
               (GROUP_CONCAT(DISTINCT CONCAT(?manifestation_agent_relationship_label, "${SPARQL_SEP.LABEL}", ?manifestation_agent_names) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?manifestation_creators)
        FROM <http://www.ontotext.com/explicit>
        WHERE {
          { <${sanitizeSparqlUri(expressionUri)}> rdaeo:P20059 ?manifestation . }
          UNION
          { ?manifestation rdamo:P30139 <${sanitizeSparqlUri(expressionUri)}> . }
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
          BIND(COALESCE(?mediatype_chosen, ?mediatype_en) AS ?mediatype_uri_val)
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
          BIND(COALESCE(?carriertype_chosen, ?carriertype_en) AS ?carriertype_uri_val)

          #Manifestation to agent relationships
          OPTIONAL {
            SELECT DISTINCT ?manifestation ?manifestation_agent_relationship_label
            (GROUP_CONCAT(DISTINCT ?manifestation_agent_name_x ; SEPARATOR="${SPARQL_SEP.NAME}") as ?manifestation_agent_names)
            WHERE {
              {
                OPTIONAL {
                  ?manifestation ?manifestation_agent_relationship ?manifestation_agent .
                  ?manifestation_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?manifestation_agent_name_x .
                  ?manifestation_agent_relationship rdfs:label ?manifestation_agent_relationship_label .
                  FILTER(LANG(?manifestation_agent_relationship_label) = "${escapeSparqlLiteral(language)}") .
                }
              } UNION {
                OPTIONAL {
                  ?manifestation_agent ?manifestation_agent_relationship ?manifestation .
                  ?manifestation_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?manifestation_agent_name_x .
                  ?manifestation_agent_relationship_inverse owl:inverseOf ?manifestation_agent_relationship .
                  ?manifestation_agent_relationship_inverse rdfs:label ?manifestation_agent_relationship_label .
                  FILTER(LANG(?manifestation_agent_relationship_label) = "${escapeSparqlLiteral(language)}") .
                }
              }
            }
            GROUP BY ?manifestation ?manifestation_agent_relationship_label
          }
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
        mediatypeUri: binding.mediatype_uri?.value,
        carriertype: binding.carriertypelabel?.value,
        carriertypeUri: binding.carriertype_uri?.value,
        manifestation_creators: binding.manifestation_creators?.value,
      }));
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
