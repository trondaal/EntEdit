import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";

export interface SearchResult {
  uri: string;
  expressiontitle?: string;
  worktitle?: string;
  worknames?: string;
  expressionnames?: string;
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
              (SAMPLE(?expressiontitle) as ?expressiontitle) 
              (SAMPLE(?worktitle) as ?worktitle) 
              (SAMPLE(?worknames) as ?worknames)
              (SAMPLE(?expressionnames) as ?expressionnames)
              (SAMPLE(?languagelabel) as ?languagelabel)
              (SAMPLE(?contenttypelabel) as ?contentlabel)
              (SAMPLE(?worktypelabel) as ?worktypelabel)
              (SAMPLE(?score) as ?score)
        WHERE {
            ?search a inst:entitiesIndex ;
            #lucene:query "Hamsun" ;
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

            #Creator names related to works, choose based on language
            OPTIONAL {
                ?work local:creators ?worknames_chosen .
                FILTER(LANG(?worknames_chosen) = "${language}")
            }
            OPTIONAL {
                ?work local:creators ?worknames_empty .
                FILTER(LANG(?worknames_empty) = "")
            }
          OPTIONAL {
                ?work local:creators ?worknames_en .
                FILTER(LANG(?worknames_en) = "en") 
            }
            BIND(COALESCE(?worknames_chosen, ?worknames_none, ?worknames_en) AS ?worknames)
            
          #Names of agents and their roles related to expressions
            OPTIONAL {
                ?expression local:creators ?expressionnames_chosen .
                FILTER(LANG(?expressionnames_chosen) = "${language}")
            }
            OPTIONAL {
                ?expression local:creators ?expressionnames_none .
                FILTER(LANG(?expressionnames_none) = "")
            }
            OPTIONAL {
                ?expression local:creators ?expressionnames_en .
                FILTER(LANG(?expressionnames_en) = "en") 
            }
                
            BIND(COALESCE(?expressionnames_chosen, ?expressionnames_none, ?expressionnames_en) AS ?expressionnames)

            #language label, we use english as default
            OPTIONAL {
                ?expression rdaed:P20006 ?language_chosen .
                ?language_chosen rdfs:label ?languagelabel_chosen .
                FILTER(LANG(?languagelabel_chosen) = "${language}")
            }
            OPTIONAL {
                ?expression rdaed:P20006 ?language_none .
                ?language_none rdfs:label ?languagelabel_none .
                FILTER(LANG(?languagelabel_none) = "")
            }
            OPTIONAL {
                ?expression rdaed:P20006 ?language_en .
                ?language_en rdfs:label ?languagelabel_en .
                FILTER(LANG(?languagelabel_en) = "en")
            }
            
              BIND(COALESCE(?languagelabel_chosen, ?languagelabel_none, ?languagelabel_en) AS ?languagelabel)
            

            #contenttype label, we use english as default
            OPTIONAL {
                ?expression rdaed:P20001 ?contenttype_chosen .
                ?contenttype_chosen rdfs:label ?contenttypelabel_chosen .
                FILTER(LANG(?contenttypelabel_chosen) = "${language}")
            }
            OPTIONAL {
                ?expression rdaed:P20001 ?contenttype_none .
                ?contenttype_none rdfs:label ?contenttypelabel_none .
                FILTER(LANG(?contenttypelabel_none) = "")
            }
            OPTIONAL {
                ?expression rdaed:P20001 ?contenttype_en .
                ?contenttype_en rdfs:label ?contenttypelabel_en .
                FILTER(LANG(?contenttypelabel_en) = "en")
            }
            
              BIND(COALESCE(?contenttypelabel_chosen, ?contenttypelabel_none, ?contenttypelabel_en) AS ?contenttypelabel)
            
            #worktype label, we use english as default
            OPTIONAL {
                ?work rdawd:P10004 ?worktype_chosen .
                ?worktype_chosen rdfs:label ?worktypelabel_chosen .
                FILTER(LANG(?worktypelabel_chosen) = "${language}")
            }
            OPTIONAL {
                ?work rdawd:P10004 ?worktype_none .
                ?worktype_none rdfs:label ?worktypelabel_none .
                FILTER(LANG(?worktypelabel_none) = "")
            }
            OPTIONAL {
                ?work rdawd:P10004 ?worktype_en .
                ?worktype_en rdfs:label ?worktypelabel_en .
                FILTER(LANG(?worktypelabel_en) = "en")
            }
          
              BIND(COALESCE(?worktypelabel_chosen, ?worktypelabel_none, ?worktypelabel_en) AS ?worktypelabel)
            

        }
        GROUP BY ?expression
        ORDER BY DESC(?score)
      `;

      const response = await client.query(sparqlQuery);

      return response.results.bindings.map((binding) => ({
        uri: binding.expression.value,
        expressiontitle: binding.expressiontitle?.value,
        worktitle: binding.worktitle?.value,
        worknames: binding.worknames?.value,
        expressionnames: binding.expressionnames?.value,
        language: binding.languagelabel?.value,
        contenttype: binding.contentlabel?.value,
        worktype: binding.worktypelabel?.value,
        score: binding.score ? parseFloat(binding.score.value) : undefined,
      }));
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
