import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";

export interface SearchResult {
  uri: string;
  expression_title?: string;
  work_title?: string;
  work_creators?: string;
  expression_creators?: string;
  language?: string;
  contenttype?: string;
  worktype?: string;
  score?: number;
}

export const useSearchEntities = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useQuery({
    queryKey: ["search", config.url, query, language],
    queryFn: async (): Promise<SearchResult[]> => {
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
            
      WHERE {
          ?search a inst:entitiesIndex ;
          #lucene:query "horses" ;
          lucene:query "${query.replace(/"/g, '\\"')}" ;
          lucene:entities ?expression .
          ?expression lucene:score ?score .
          ?expression a <http://rdaregistry.info/Elements/c/C10006> .
          ?expression rdaeo:P20231 ?work .

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

          OPTIONAL {
              SELECT DISTINCT ?work ?work_agent_relationship_label 
              (GROUP_CONCAT(?work_agent_name_x ; SEPARATOR=" & ") as ?work_agent_names)
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
          
              OPTIONAL {
              SELECT DISTINCT ?expression ?expression_agent_relationship_label 
              (GROUP_CONCAT(?expression_agent_name_x ; SEPARATOR=" & ") as ?expression_agent_names)
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
        score: binding.score ? parseFloat(binding.score.value) : undefined,
      }));
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
