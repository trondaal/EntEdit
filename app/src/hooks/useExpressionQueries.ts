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
      }));
    },
    enabled: Boolean(manifestationUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
