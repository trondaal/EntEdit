import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";

export interface Manifestation {
  uri: string;
  title?: string;
  other?: string;
  responsibilityStatement?: string;
  date?: string;
  publisher?: string;
  place?: string;
  extent?: string;
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
               (SAMPLE(?title) as ?title)
               (SAMPLE(?responsibilityStatement) as ?responsibilityStatement)
               (SAMPLE(?other) as ?other)
               (SAMPLE(?date) as ?date)
               (SAMPLE(?publisher) as ?publisher)
               (SAMPLE(?place) as ?place)
               (SAMPLE(?extent) as ?extent)
               (SAMPLE(?mediatypelabel) as ?mediatypelabel)
               (SAMPLE(?carriertypelabel) as ?carriertypelabel)
        WHERE {
          <${expressionUri}> rdaeo:P20059 ?manifestation .
          OPTIONAL {
            ?manifestation rdamd:P30134 ?title .
          }
          OPTIONAL {
            ?manifestation rdamd:P30142 ?other .
          }
          OPTIONAL {
            ?manifestation rdamd:P30117 ?responsibilityStatement .
          }
          OPTIONAL {
            ?manifestation rdamd:P30278 ?date.
          }
          OPTIONAL {
            ?manifestation rdamd:P30329 ?publisher.
          }
          OPTIONAL {
            ?manifestation rdamd:P30279 ?place.
          }
          OPTIONAL {
            ?manifestation rdamd:P30182 ?extent.
          }
          #mediatype label, we use english as default
          OPTIONAL {
              ?manifestation rdamo:P30002 ?mediatype_chosen .
              ?mediatype_chosen rdfs:label ?mediatypelabel_chosen .
              FILTER(LANG(?mediatypelabel_chosen) = "${language}")
          }
          OPTIONAL {
              ?manifestation rdamo:P30002 ?mediatype_none .
              ?mediatype_none rdfs:label ?mediatypelabel_none .
              FILTER(LANG(?mediatypelabel_none) = "")
          }
          OPTIONAL {
              ?manifestation rdamo:P30002 ?mediatype_en .
              ?mediatype_en rdfs:label ?mediatypelabel_en .
              FILTER(LANG(?mediatypelabel_en) = "en")
          }
          BIND(COALESCE(?mediatypelabel_chosen, ?mediatypelabel_none, ?mediatypelabel_en) AS ?mediatypelabel)
           #carriertype label, we use english as default
          OPTIONAL {
              ?manifestation rdamo:P30001  ?carriertype_chosen .
              ?carriertype_chosen rdfs:label ?carriertypelabel_chosen .
              FILTER(LANG(?carriertypelabel_chosen) = "${language}")
          }
          OPTIONAL {
              ?manifestation rdamo:P30001 ?carriertype_none .
              ?carriertype_none rdfs:label ?carriertypelabel_none .
              FILTER(LANG(?carriertypelabel_none) = "")
          }
          OPTIONAL {
              ?manifestation rdamo:P30001 ?carriertype_en .
              ?carriertype_en rdfs:label ?carriertypelabel_en .
              FILTER(LANG(?carriertypelabel_en) = "en")
          }
          BIND(COALESCE(?carriertypelabel_chosen, ?carriertypelabel_none, ?carriertypelabel_en) AS ?carriertypelabel)
        }
        GROUP BY ?manifestation
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.manifestation.value,
        title: binding.title?.value,
        other: binding.other?.value,
        responsibilityStatement: binding.responsibilityStatement?.value,
        date: binding.date?.value,
        publisher: binding.publisher?.value,
        place: binding.place?.value,
        extent: binding.extent?.value,
        mediatype: binding.mediatypelabel?.value,
        carriertype: binding.carriertypelabel?.value,
      }));
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
