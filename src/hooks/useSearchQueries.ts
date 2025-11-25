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
  work_to_work_relationships?: string;
  expression_to_expression_relationships?: string;
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
		(GROUP_CONCAT(DISTINCT CONCAT(?work_to_work_relationship_label, ": ", ?target_work_title) ; SEPARATOR=" ; ") as ?work_to_work_relationships)
(GROUP_CONCAT(DISTINCT CONCAT(?expression_to_expression_relationship_label, ": ", ?target_expression_title) ; SEPARATOR=" ; ") as ?expression_to_expression_relationships)
FROM <http://www.ontotext.com/explicit>
	  	
WHERE {
    ?search a inst:entitiesIndex ;
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
            OPTIONAL {
                ?work ?work_to_work_relationship ?target_work .
                ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                ?target_work rdawd:P10088 ?target_work_title .
                ?work_to_work_relationship rdfs:label ?work_to_work_relationship_label .
                FILTER(LANG(?work_to_work_relationship_label) = "${language}") .
		 	}
        }
        GROUP BY ?work ?work_to_work_relationship_label
    }
    
    #Expression to expression relationships
    OPTIONAL {
        SELECT DISTINCT ?expression ?expression_to_expression_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_expression_title, " = ", STR(?target_expression))  ; SEPARATOR=" & ") as ?target_expression_title)
        WHERE {
            OPTIONAL {
                ?expression ?expression_to_expression_relationship ?target_expression .
                ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                ?target_expression rdaed:P20312 ?target_expression_title .
				?expression_to_expression_relationship rdfs:label ?expression_to_expression_relationship_label .
                FILTER(LANG(?expression_to_expression_relationship_label) = "${language}") .

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
        expression_to_expression_relationships: binding.expression_to_expression_relationships?.value,
        score: binding.score ? parseFloat(binding.score.value) : undefined,
      }));
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
