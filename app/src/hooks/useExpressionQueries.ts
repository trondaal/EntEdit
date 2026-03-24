import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import { sanitizeSparqlUri } from "../utils/labelUtils";
import { SPARQL_SEP } from "../utils/textFormatters";

export interface Expression {
  uri: string;
  title?: string;
  work_title?: string;
  language?: string;
  contenttype?: string;
  contenttypeUri?: string;
  workcategory?: string;
  genre?: string;
  work_creators?: string;
  expression_creators?: string;
  work_to_work_relationships?: string;
  expression_to_expression_relationships?: string;
}

export const useExpressionsByManifestation = (
  config: SparqlEndpointConfig,
  manifestationUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: [
      "expressionsByManifestation",
      config.url,
      manifestationUri,
      language,
    ],
    queryFn: async (): Promise<Expression[]> => {
      if (!manifestationUri) {
        return [];
      }

      const client = new SparqlClient(config);

      const sparqlQuery = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdaed: <http://rdaregistry.info/Elements/e/datatype/>
        PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
        PREFIX rdawd: <http://rdaregistry.info/Elements/w/datatype/>
        PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
        PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>
        PREFIX vocab: <http://oslomet.no/abi/vocab#>

        SELECT DISTINCT ?expression
               (SAMPLE(?expressiontitle) as ?title)
               (SAMPLE(?worktitle) as ?work_title)
               (GROUP_CONCAT(DISTINCT ?language_label ; SEPARATOR=" ; ") as ?language)
               (GROUP_CONCAT(DISTINCT ?contenttype_label ; SEPARATOR=" ; ") as ?contenttype)
               (SAMPLE(?contenttype) as ?contenttype_uri)
               (GROUP_CONCAT(DISTINCT ?workcategory_label ; SEPARATOR=" ; ") as ?workcategory)
               (GROUP_CONCAT(DISTINCT ?genre_label ; SEPARATOR=" ; ") as ?genre)
               (GROUP_CONCAT(DISTINCT CONCAT(?work_agent_relationship_label, "${SPARQL_SEP.LABEL}", ?work_agent_names) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?work_creators)
               (GROUP_CONCAT(DISTINCT CONCAT(?expression_agent_relationship_label, "${SPARQL_SEP.LABEL}", ?expression_agent_names) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?expression_creators)
               (GROUP_CONCAT(DISTINCT CONCAT(?work_to_work_relationship_label, "${SPARQL_SEP.LABEL}", ?target_work_title) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?work_to_work_relationships)
               (GROUP_CONCAT(DISTINCT CONCAT(?expression_to_expression_relationship_label, "${SPARQL_SEP.LABEL}", ?target_expression_title) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?expression_to_expression_relationships)
               FROM <http://www.ontotext.com/explicit>
               WHERE {
          # Navigate from manifestation to expression
          {<${sanitizeSparqlUri(manifestationUri)}> rdamo:P30139 ?expression}
          UNION
          {?expression rdaeo:P20059 <${sanitizeSparqlUri(manifestationUri)}>}

          # Get expressions and work
          { ?expression rdaeo:P20231 ?work }
          UNION
          { ?work rdawo:P10078 ?expression }

          # Expression and Work titles
          OPTIONAL {
            ?expression rdaed:P20315 ?expressiontitle .
          }
          OPTIONAL {
            ?work rdawd:P10223 ?worktitle .
          }

          # Language
          OPTIONAL {
            ?expression rdaeo:P20006 ?language .
            ?language rdfs:label ?language_label .
            FILTER(LANG(?language_label) = "${language}")
          }

          # Content type
          OPTIONAL {
            ?expression rdaeo:P20001 ?contenttype .
            ?contenttype rdfs:label ?contenttype_label .
            FILTER(LANG(?contenttype_label) = "${language}")
          }

          # Work category
          OPTIONAL {
            ?work vocab:P01 ?workcategory .
            ?workcategory rdfs:label ?workcategory_label .
            FILTER(LANG(?workcategory_label) = "${language}")
          }

          # Genre
          OPTIONAL {
            ?work vocab:P02 ?genre_entity .
            ?genre_entity rdfs:label ?genre_label .
            FILTER(LANG(?genre_label) = "${language}")
          }

          # Work to agent relationships
          OPTIONAL {
            SELECT DISTINCT ?work ?work_agent_relationship_label
            (GROUP_CONCAT(DISTINCT CONCAT(?work_agent_name_x, "${SPARQL_SEP.URI}", STR(?work_agent)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?work_agent_names)
            WHERE {
              {
                OPTIONAL {
                  ?work ?work_agent_relationship ?work_agent .
                  ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?work_agent_name_x .
                  ?work_agent_relationship rdfs:label ?work_agent_relationship_label .
                  FILTER(LANG(?work_agent_relationship_label) = "${language}") .
                }
              }UNION{
                OPTIONAL {
                  ?work_agent ?work_agent_relationship ?work .
                  ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?work_agent_name_x .
                  ?work_agent_relationship_inverse owl:inverseOf ?work_agent_relationship .
                  ?work_agent_relationship_inverse rdfs:label ?work_agent_relationship_label .
                  FILTER(LANG(?work_agent_relationship_label) = "${language}") .
                }
              }
            }
            GROUP BY ?work ?work_agent_relationship_label
          }

          # Expression to agent relationships
          OPTIONAL {
            SELECT DISTINCT ?expression ?expression_agent_relationship_label
            (GROUP_CONCAT(DISTINCT CONCAT(?expression_agent_name_x, "${SPARQL_SEP.URI}", STR(?expression_agent)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?expression_agent_names)
            WHERE {
              {
                OPTIONAL {
                  ?expression ?expression_agent_relationship ?expression_agent .
                  ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?expression_agent_name_x .
                  ?expression_agent_relationship rdfs:label ?expression_agent_relationship_label .
                  FILTER(LANG(?expression_agent_relationship_label) = "${language}") .
                }
              }UNION{
                OPTIONAL {
                  ?expression_agent ?expression_agent_relationship ?expression .
                  ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50413> ?expression_agent_name_x .
                  ?expression_agent_relationship_inverse owl:inverseOf ?expression_agent_relationship .
                  ?expression_agent_relationship_inverse rdfs:label ?expression_agent_relationship_label .
                  FILTER(LANG(?expression_agent_relationship_label) = "${language}") .
                }
              }
            }
            GROUP BY ?expression ?expression_agent_relationship_label
          }

          # Work to work relationships
          OPTIONAL {
            SELECT DISTINCT ?work ?work_to_work_relationship_label
            (GROUP_CONCAT(DISTINCT CONCAT(?target_work_title, "${SPARQL_SEP.URI}", STR(?target_work)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?target_work_title)
            WHERE {
              {
                OPTIONAL {
                  ?work ?work_to_work_relationship ?target_work .
                  ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                  OPTIONAL { ?target_work rdfs:label ?tw_label_lang . FILTER(LANG(?tw_label_lang) = "${language}") }
                  OPTIONAL { ?target_work rdfs:label ?tw_label_none . FILTER(LANG(?tw_label_none) = "") }
                  BIND(COALESCE(?tw_label_lang, ?tw_label_none) AS ?target_work_title)
                  FILTER(BOUND(?target_work_title))
                  ?work_to_work_relationship rdfs:label ?work_to_work_relationship_label .
                  FILTER(LANG(?work_to_work_relationship_label) = "${language}") .
                  FILTER NOT EXISTS {
                    ?work_to_work_relationship rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
                  }
                }
              } UNION {
                OPTIONAL {
                  ?target_work ?work_to_work_relationship ?work .
                  ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                  OPTIONAL { ?target_work rdfs:label ?tw_label_lang2 . FILTER(LANG(?tw_label_lang2) = "${language}") }
                  OPTIONAL { ?target_work rdfs:label ?tw_label_none2 . FILTER(LANG(?tw_label_none2) = "") }
                  BIND(COALESCE(?tw_label_lang2, ?tw_label_none2) AS ?target_work_title)
                  FILTER(BOUND(?target_work_title))
                  ?work_to_work_relationship_inverse owl:inverseOf ?work_to_work_relationship .
                  ?work_to_work_relationship_inverse rdfs:label ?work_to_work_relationship_label .
                  FILTER(LANG(?work_to_work_relationship_label) = "${language}") .
                  FILTER NOT EXISTS {
                    ?work_to_work_relationship_inverse rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
                  }
                }
              }
            }
            GROUP BY ?work ?work_to_work_relationship_label
          }

          # Expression to expression relationships
          OPTIONAL {
            SELECT DISTINCT ?expression ?expression_to_expression_relationship_label
            (GROUP_CONCAT(DISTINCT CONCAT(?target_expression_title, "${SPARQL_SEP.URI}", STR(?target_expression)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?target_expression_title)
            WHERE {
              {
                OPTIONAL {
                  ?expression ?expression_to_expression_relationship ?target_expression .
                  ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                  OPTIONAL { ?target_expression rdfs:label ?te_label_lang . FILTER(LANG(?te_label_lang) = "${language}") }
                  OPTIONAL { ?target_expression rdfs:label ?te_label_none . FILTER(LANG(?te_label_none) = "") }
                  BIND(COALESCE(?te_label_lang, ?te_label_none) AS ?target_expression_title)
                  FILTER(BOUND(?target_expression_title))
                  ?expression_to_expression_relationship rdfs:label ?expression_to_expression_relationship_label .
                  FILTER(LANG(?expression_to_expression_relationship_label) = "${language}") .
                }
              } UNION {
                OPTIONAL {
                  ?target_expression ?expression_to_expression_relationship ?expression .
                  ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                  OPTIONAL { ?target_expression rdfs:label ?te_label_lang2 . FILTER(LANG(?te_label_lang2) = "${language}") }
                  OPTIONAL { ?target_expression rdfs:label ?te_label_none2 . FILTER(LANG(?te_label_none2) = "") }
                  BIND(COALESCE(?te_label_lang2, ?te_label_none2) AS ?target_expression_title)
                  FILTER(BOUND(?target_expression_title))
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
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.expression.value,
        title: binding.title?.value,
        work_title: binding.work_title?.value,
        language: binding.language?.value,
        contenttype: binding.contenttype?.value,
        contenttypeUri: binding.contenttype_uri?.value,
        workcategory: binding.workcategory?.value,
        genre: binding.genre?.value,
        work_creators: binding.work_creators?.value,
        expression_creators: binding.expression_creators?.value,
        work_to_work_relationships: binding.work_to_work_relationships?.value,
        expression_to_expression_relationships: binding.expression_to_expression_relationships?.value,
      }));
    },
    enabled: Boolean(manifestationUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
