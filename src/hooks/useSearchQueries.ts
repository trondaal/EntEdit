import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";

export interface ExpressionSearchResult {
  uri: string;
  expression_title?: string;
  work_title?: string;
  work_creators?: string;
  expression_creators?: string;
  language?: string;
  contenttype?: string;
  worktype?: string;
  work_to_work_relationships?: string;
  expression_to_expression_relationships?: string;
  score?: number;
}

export interface ManifestationSearchResult {
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

export const useSearchExpressions = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useQuery({
    queryKey: ["searchExpressions", config.url, query, language],
    queryFn: async (): Promise<ExpressionSearchResult[]> => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const client = new SparqlClient(config);

      // GraphDB Lucene connector search query
      // This query uses the lucene:query predicate to perform fulltext search
      const sparqlQuery = `
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdaed: <http://rdaregistry.info/Elements/e/datatype/>
PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
PREFIX rdawd: <http://rdaregistry.info/Elements/w/datatype/>
PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
PREFIX local: <http://oslomet.no/abi/>

SELECT DISTINCT ?expression
		(SAMPLE(?expressiontitle) as ?expression_title)
		(SAMPLE(?worktitle) as ?work_title)
		(GROUP_CONCAT(DISTINCT ?language_label ; SEPARATOR=" ; ") as ?language)
		(GROUP_CONCAT(DISTINCT ?contenttype_label ; SEPARATOR=" ; ") as ?contenttype)
		(GROUP_CONCAT(DISTINCT ?worktype_label ; SEPARATOR=" ; ") as ?worktype)
		(GROUP_CONCAT(DISTINCT CONCAT(?work_agent_relationship_label, ": ", ?work_agent_names) ; SEPARATOR=" ; ") as ?work_creators)
		(GROUP_CONCAT(DISTINCT CONCAT(?expression_agent_relationship_label, ": ", ?expression_agent_names) ; SEPARATOR=" ; ") as ?expression_creators)
		(GROUP_CONCAT(DISTINCT CONCAT(?work_to_work_relationship_label, ": ", ?target_work_title) ; SEPARATOR=" ; ") as ?work_to_work_relationships)
(GROUP_CONCAT(DISTINCT CONCAT(?expression_to_expression_relationship_label, ": ", ?target_expression_title) ; SEPARATOR=" ; ") as ?expression_to_expression_relationships)
FROM <http://www.ontotext.com/explicit>

WHERE {
    ?search a inst:expressionsIndex ;
    #lucene:query "horses" ;
    lucene:query "${query.replace(/"/g, '\\"')}" ;
    lucene:entities ?expression .
    ?expression lucene:score ?score .
    ?expression a <http://rdaregistry.info/Elements/c/C10006> .

        {?expression rdaeo:P20231 ?work .}
            UNION
        {?work rdawo:P10078 ?expression .}

    #Titles, we assume they have no language tag.
    OPTIONAL {
        ?expression rdaed:P20312 ?expressiontitle .
    }
	OPTIONAL {
        ?work rdawd:P10088 ?worktitle .
    }

    #language label, we use english as default
    OPTIONAL {
        ?expression rdaeo:P20006 ?language .
        ?language rdfs:label ?language_label .
        FILTER(LANG(?language_label) = "en")
    }
    OPTIONAL {
        ?expression rdaeo:P20001 ?contenttype .
        ?contenttype rdfs:label ?contenttype_label .
        FILTER(LANG(?contenttype_label) = "${language}")
    }
    OPTIONAL {
        ?work rdawo:P10004 ?worktype .
        ?worktype rdfs:label ?worktype_label .
        FILTER(LANG(?worktype_label) = "${language}")
    }

    #Work to agent relationships
    OPTIONAL {
        SELECT DISTINCT ?work ?work_agent_relationship_label
        (GROUP_CONCAT(DISTINCT ?work_agent_name_x ; SEPARATOR=" & ") as ?work_agent_names)
        WHERE {
            {
                OPTIONAL {
                    ?work ?work_agent_relationship ?work_agent .
                    ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?work_agent_name_x .
                    ?work_agent_relationship rdfs:label ?work_agent_relationship_label .
                    FILTER(LANG(?work_agent_relationship_label) = "${language}") .
            	}
            }UNION{
                OPTIONAL {
                    ?work_agent ?work_agent_relationship ?work .
                    ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?work_agent_name_x .
                    ?work_agent_relationship_inverse owl:inverseOf ?work_agent_relationship .
                    ?work_agent_relationship_inverse rdfs:label ?work_agent_relationship_label .
                    FILTER(LANG(?work_agent_relationship_label) = "${language}") .
            	}
            }
        }
        GROUP BY ?work ?work_agent_relationship_label
    }

        #Expression to agent relationships
    OPTIONAL {
        SELECT DISTINCT ?expression ?expression_agent_relationship_label
        (GROUP_CONCAT(DISTINCT ?expression_agent_name_x ; SEPARATOR=" & ") as ?expression_agent_names)
        WHERE {
            {
                OPTIONAL {
                    ?expression ?expression_agent_relationship ?expression_agent .
                    ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?expression_agent_name_x .
                    ?expression_agent_relationship rdfs:label ?expression_agent_relationship_label .
                    FILTER(LANG(?expression_agent_relationship_label) = "${language}") .
            	}
            }UNION{
                  OPTIONAL {
                    ?expression_agent ?expression_agent_relationship ?expression .
                    ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?expression_agent_name_x .
                    ?expression_agent_relationship_inverse owl:inverseOf ?expression_agent_relationship .
                    ?expression_agent_relationship_inverse rdfs:label ?expression_agent_relationship_label .
                    FILTER(LANG(?expression_agent_relationship_label) = "${language}") .
            	}
            }
        }
        GROUP BY ?expression ?expression_agent_relationship_label
    }

    #Work to work relationships
    OPTIONAL {
        SELECT DISTINCT ?work ?work_to_work_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_work_title, " = ", STR(?target_work))  ; SEPARATOR=" & ") as ?target_work_title)
        WHERE {
            {
                OPTIONAL {
                    ?work ?work_to_work_relationship ?target_work .
                    ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                    ?target_work rdawd:P10088 ?target_work_title .
                    ?work_to_work_relationship rdfs:label ?work_to_work_relationship_label .
                    FILTER(LANG(?work_to_work_relationship_label) = "${language}") .
                    FILTER NOT EXISTS {
    					?work_to_work_relationship rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
  					}
                }
            }UNION {
                OPTIONAL {
                    ?target_work ?work_to_work_relationship ?work .
                    ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                    ?target_work rdawd:P10088 ?target_work_title .
                    ?work_to_work_relationship_inverse owl:inverseOf ?work_to_work_relationship .
                    ?work_to_work_relationship_inverse rdfs:label ?work_to_work_relationship_label .
                    #?work_to_work_relationship rdfs:label ?work_to_work_relationship_label .
                    FILTER(LANG(?work_to_work_relationship_label) = "${language}") .
                    FILTER NOT EXISTS {
    					?work_to_work_relationship_inverse rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
  					}
                }
            }

        }
        GROUP BY ?work ?work_to_work_relationship_label
    }

    #Expression to expression relationships
    OPTIONAL {
        SELECT DISTINCT ?expression ?expression_to_expression_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_expression_title, " = ", STR(?target_expression))  ; SEPARATOR=" & ") as ?target_expression_title)
        WHERE {
                {
                OPTIONAL {
                    ?expression ?expression_to_expression_relationship ?target_expression .
                    ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                    ?target_expression rdaed:P20315 ?target_expression_title .
                    ?expression_to_expression_relationship rdfs:label ?expression_to_expression_relationship_label .
                    FILTER(LANG(?expression_to_expression_relationship_label) = "${language}") .
                }
            }UNION{
                OPTIONAL {
                    ?target_expression ?expression_to_expression_relationship ?expression .
                    ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                    ?target_expression rdaed:P20315 ?target_expression_title .
                    ?expression_to_expression_relationship_inverse owl:inverseOf ?expression_to_expression_relationship .
                    ?expression_to_expression_relationship_inverse rdfs:label ?expression_to_expression_relationship_label .
                    FILTER(LANG(?expression_to_expression_relationship_label) = "${language}") .
                }
            }

        }
        GROUP BY ?expression ?expression_to_expression_relationship_label
    }
}
GROUP BY ?expression
ORDER BY DESC(?score)
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.expression.value,
        expression_title: binding.expression_title?.value,
        work_title: binding.work_title?.value,
        work_creators: binding.work_creators?.value,
        expression_creators: binding.expression_creators?.value,
        language: binding.language?.value,
        contenttype: binding.contenttype?.value,
        worktype: binding.worktype?.value,
        work_to_work_relationships: binding.work_to_work_relationships?.value,
        expression_to_expression_relationships:
          binding.expression_to_expression_relationships?.value,
        score: binding.score ? parseFloat(binding.score.value) : undefined,
      }));
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSearchManifestations = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useQuery({
    queryKey: ["searchManifestations", config.url, query, language],
    queryFn: async (): Promise<ManifestationSearchResult[]> => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const client = new SparqlClient(config);

      const sparqlQuery = `
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
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
    (SAMPLE(?mediatype_label) as ?mediatype)
    (SAMPLE(?carriertype_label) as ?carriertype)
WHERE {
    ?search a inst:manifestationsIndex ;
    lucene:query "${query.replace(/"/g, '\\"')}" ;
    lucene:entities ?manifestation .
    ?manifestation lucene:score ?score .
    ?manifestation a <http://rdaregistry.info/Elements/c/C10007> .

    # Title area
    OPTIONAL {
        ?manifestation rdamd:P30156 ?title_val .  # title proper
    }
    OPTIONAL {
        ?manifestation rdamd:P30142 ?other_val .  # other title info
    }
    OPTIONAL {
        ?manifestation rdamd:P30117 ?responsibilityStatement_val .  # responsibility statement
    }
    # Publication area
    OPTIONAL {
        ?manifestation rdamd:P30107 ?edition_val .  # edition statement
    }
    OPTIONAL {
        ?manifestation rdamd:P30088 ?place_val .  # publication place
    }
    OPTIONAL {
        ?manifestation rdamd:P30076 ?publisher_val .  # publisher name
    }
    OPTIONAL {
        ?manifestation rdamd:P30011 ?date_val .  # publication date
    }
    # Physical description
    OPTIONAL {
        ?manifestation rdamd:P30182 ?extent_val .  # extent
    }
    OPTIONAL {
        ?manifestation rdamd:P30169 ?dimensions_val .  # dimensions
    }
    # Series
    OPTIONAL {
        ?manifestation rdamd:P30106 ?series_val .  # series statement
    }
    OPTIONAL {
        ?manifestation rdamd:P30165 ?seriesNumbering_val .  # numbering within series
    }
    # Notes (multiple values)
    OPTIONAL {
        ?manifestation rdamd:P30137 ?note_val .  # note
    }
    # Identifiers (multiple values)
    OPTIONAL {
        ?manifestation rdamd:P30004 ?identifier_val .  # identifier
    }

    # Media type with language fallback
    OPTIONAL {
        ?manifestation rdamo:P30002 ?mediatype_chosen .
        ?mediatype_chosen rdfs:label ?mediatype_label_chosen .
        FILTER(LANG(?mediatype_label_chosen) = "${language}")
    }
    OPTIONAL {
        ?manifestation rdamo:P30002 ?mediatype_en .
        ?mediatype_en rdfs:label ?mediatype_label_en .
        FILTER(LANG(?mediatype_label_en) = "en")
    }
    BIND(COALESCE(?mediatype_label_chosen, ?mediatype_label_en) AS ?mediatype_label)

    # Carrier type with language fallback
    OPTIONAL {
        ?manifestation rdamo:P30001 ?carriertype_chosen .
        ?carriertype_chosen rdfs:label ?carriertype_label_chosen .
        FILTER(LANG(?carriertype_label_chosen) = "${language}")
    }
    OPTIONAL {
        ?manifestation rdamo:P30001 ?carriertype_en .
        ?carriertype_en rdfs:label ?carriertype_label_en .
        FILTER(LANG(?carriertype_label_en) = "en")
    }
    BIND(COALESCE(?carriertype_label_chosen, ?carriertype_label_en) AS ?carriertype_label)
}
GROUP BY ?manifestation
ORDER BY DESC(?score)
      `;

      const response = await client.query(sparqlQuery);

      console.log("useSearchManifestations SPARQL response:", {
        query: sparqlQuery,
        bindings: response.results.bindings,
        firstBinding: response.results.bindings[0],
      });

      const results = response.results.bindings.map((binding) => ({
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
        mediatype: binding.mediatype?.value,
        carriertype: binding.carriertype?.value,
      }));

      console.log("Mapped manifestation results:", results);
      return results;
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
