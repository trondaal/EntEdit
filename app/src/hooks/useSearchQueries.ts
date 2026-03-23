import { useInfiniteQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { escapeSparqlLiteral, sanitizeSparqlUri } from "../utils/labelUtils";
import { SPARQL_SEP } from "../utils/textFormatters";
import type { SparqlEndpointConfig } from "../types/sparql";

/** Number of search results fetched per page */
export const SEARCH_PAGE_SIZE = 20;

export interface ExpressionSearchResult {
  uri: string;
  expression_title?: string;
  work_title?: string;
  work_creators?: string;
  expression_creators?: string;
  language?: string;
  contenttype?: string;
  contenttypeUri?: string;
  workcategory?: string;
  genre?: string;
  work_to_work_relationships?: string;
  expression_to_expression_relationships?: string;
  manifestation_count?: number;
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
  mediatypeUri?: string;
  carriertype?: string;
  carriertypeUri?: string;
  // Agents
  manifestation_creators?: string;
  // Count
  expression_count?: number;
}

/** Build a VALUES clause from an array of URIs */
const buildValuesClause = (varName: string, uris: string[]): string => {
  const values = uris.map((uri) => `<${sanitizeSparqlUri(uri)}>`).join(" ");
  return `VALUES ${varName} { ${values} }`;
};

export const useSearchExpressions = (
  config: SparqlEndpointConfig,
  query: string,
  language: string,
) => {
  return useInfiniteQuery({
    queryKey: ["searchExpressions", config.url, query, language],
    queryFn: async ({ pageParam = 0 }): Promise<ExpressionSearchResult[]> => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const client = new SparqlClient(config);
      const escapedQuery = escapeSparqlLiteral(query);
      const escapedLanguage = escapeSparqlLiteral(language);

      // Phase 1: Lightweight Lucene search — just URIs, scores, and work links
      const searchQuery = `
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>
PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>

SELECT ?expression ?work ?score
FROM <http://www.ontotext.com/explicit>
WHERE {
    ?search a inst:expressionsIndex ;
        lucene:query "${escapedQuery}" ;
        lucene:entities ?expression .
    ?expression lucene:score ?score .
    ?expression a <http://rdaregistry.info/Elements/c/C10006> .

    { ?expression rdaeo:P20231 ?work . }
    UNION
    { ?work rdawo:P10078 ?expression . }
}
ORDER BY DESC(?score)
LIMIT ${SEARCH_PAGE_SIZE}
OFFSET ${pageParam}
      `;

      const searchResponse = await client.query(searchQuery);
      const hits = searchResponse.results.bindings;

      if (hits.length === 0) return [];

      // Collect unique expression and work URIs for the detail query
      const expressionUris: string[] = [];
      const workUriMap = new Map<string, string>(); // expression → work
      const scoreMap = new Map<string, number>();

      for (const hit of hits) {
        const exprUri = hit.expression.value;
        if (!scoreMap.has(exprUri)) {
          expressionUris.push(exprUri);
          scoreMap.set(exprUri, parseFloat(hit.score.value));
        }
        if (hit.work?.value) {
          workUriMap.set(exprUri, hit.work.value);
        }
      }

      const allWorkUris = [...new Set(workUriMap.values())];

      // Phase 2: Fetch details for just this page's URIs
      const detailQuery = `
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdaed: <http://rdaregistry.info/Elements/e/datatype/>
PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
PREFIX rdawd: <http://rdaregistry.info/Elements/w/datatype/>
PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>
PREFIX vocab: <http://oslomet.no/abi/vocab#>

SELECT ?expression
    (SAMPLE(?expressiontitle) as ?expression_title)
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
    (COUNT(DISTINCT ?manifestation) as ?manifestation_count)
FROM <http://www.ontotext.com/explicit>
WHERE {
    ${buildValuesClause("?expression", expressionUris)}

    # Expression → work link
    { ?expression rdaeo:P20231 ?work . }
    UNION
    { ?work rdawo:P10078 ?expression . }
    ${allWorkUris.length > 0 ? buildValuesClause("?work", allWorkUris) : ""}

    # Expression → manifestation count
    OPTIONAL {
        { ?expression rdaeo:P20059 ?manifestation . }
        UNION
        { ?manifestation rdamo:P30139 ?expression . }
    }

    # Titles (no language tag expected)
    OPTIONAL {
        ?expression rdaed:P20315 ?expressiontitle .
    }
    OPTIONAL {
        ?work rdawd:P10223 ?worktitle .
    }

    # Language label
    OPTIONAL {
        ?expression rdaeo:P20006 ?language_entity .
        ?language_entity rdfs:label ?language_label .
        FILTER(LANG(?language_label) = "${escapedLanguage}")
    }
    OPTIONAL {
        ?expression rdaeo:P20001 ?contenttype .
        ?contenttype rdfs:label ?contenttype_label .
        FILTER(LANG(?contenttype_label) = "${escapedLanguage}")
    }
    OPTIONAL {
        ?work vocab:P01 ?workcategory .
        ?workcategory rdfs:label ?workcategory_label .
        FILTER(LANG(?workcategory_label) = "${escapedLanguage}")
    }
    OPTIONAL {
        ?work vocab:P02 ?genre_entity .
        ?genre_entity rdfs:label ?genre_label .
        FILTER(LANG(?genre_label) = "${escapedLanguage}")
    }

    # Work to agent relationships
    OPTIONAL {
        SELECT DISTINCT ?work ?work_agent_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?work_agent_name_x, "${SPARQL_SEP.URI}", STR(?work_agent)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?work_agent_names)
        WHERE {
            {
                OPTIONAL {
                    ?work ?work_agent_relationship ?work_agent .
                    ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?work_agent_name_x .
                    ?work_agent_relationship rdfs:label ?work_agent_relationship_label .
                    FILTER(LANG(?work_agent_relationship_label) = "${escapedLanguage}") .
                }
            } UNION {
                OPTIONAL {
                    ?work_agent ?work_agent_relationship ?work .
                    ?work_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?work_agent_name_x .
                    ?work_agent_relationship_inverse owl:inverseOf ?work_agent_relationship .
                    ?work_agent_relationship_inverse rdfs:label ?work_agent_relationship_label .
                    FILTER(LANG(?work_agent_relationship_label) = "${escapedLanguage}") .
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
                    ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?expression_agent_name_x .
                    ?expression_agent_relationship rdfs:label ?expression_agent_relationship_label .
                    FILTER(LANG(?expression_agent_relationship_label) = "${escapedLanguage}") .
                }
            } UNION {
                OPTIONAL {
                    ?expression_agent ?expression_agent_relationship ?expression .
                    ?expression_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?expression_agent_name_x .
                    ?expression_agent_relationship_inverse owl:inverseOf ?expression_agent_relationship .
                    ?expression_agent_relationship_inverse rdfs:label ?expression_agent_relationship_label .
                    FILTER(LANG(?expression_agent_relationship_label) = "${escapedLanguage}") .
                }
            }
        }
        GROUP BY ?expression ?expression_agent_relationship_label
    }

    # Work to work relationships
    # Uses rdfs:label for target work title (chosen language → no language tag)
    OPTIONAL {
        SELECT DISTINCT ?work ?work_to_work_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_work_title, "${SPARQL_SEP.URI}", STR(?target_work)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?target_work_title)
        WHERE {
            {
                OPTIONAL {
                    ?work ?work_to_work_relationship ?target_work .
                    ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                    OPTIONAL { ?target_work rdfs:label ?tw_label_lang . FILTER(LANG(?tw_label_lang) = "${escapedLanguage}") }
                    OPTIONAL { ?target_work rdfs:label ?tw_label_none . FILTER(LANG(?tw_label_none) = "") }
                    BIND(COALESCE(?tw_label_lang, ?tw_label_none) AS ?target_work_title)
                    FILTER(BOUND(?target_work_title))
                    ?work_to_work_relationship rdfs:label ?work_to_work_relationship_label .
                    FILTER(LANG(?work_to_work_relationship_label) = "${escapedLanguage}") .
                    FILTER NOT EXISTS {
                        ?work_to_work_relationship rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
                    }
                }
            } UNION {
                OPTIONAL {
                    ?target_work ?work_to_work_relationship ?work .
                    ?target_work a <http://rdaregistry.info/Elements/c/C10001> .
                    OPTIONAL { ?target_work rdfs:label ?tw_label_lang2 . FILTER(LANG(?tw_label_lang2) = "${escapedLanguage}") }
                    OPTIONAL { ?target_work rdfs:label ?tw_label_none2 . FILTER(LANG(?tw_label_none2) = "") }
                    BIND(COALESCE(?tw_label_lang2, ?tw_label_none2) AS ?target_work_title)
                    FILTER(BOUND(?target_work_title))
                    ?work_to_work_relationship_inverse owl:inverseOf ?work_to_work_relationship .
                    ?work_to_work_relationship_inverse rdfs:label ?work_to_work_relationship_label .
                    FILTER(LANG(?work_to_work_relationship_label) = "${escapedLanguage}") .
                    FILTER NOT EXISTS {
                        ?work_to_work_relationship_inverse rdfs:subPropertyOf* <http://rdaregistry.info/Elements/w/P10336> .
                    }
                }
            }
        }
        GROUP BY ?work ?work_to_work_relationship_label
    }

    # Expression to expression relationships
    # Uses rdfs:label for target expression title (chosen language → no language tag)
    OPTIONAL {
        SELECT DISTINCT ?expression ?expression_to_expression_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_expression_title, "${SPARQL_SEP.URI}", STR(?target_expression)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?target_expression_title)
        WHERE {
            {
                OPTIONAL {
                    ?expression ?expression_to_expression_relationship ?target_expression .
                    ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                    OPTIONAL { ?target_expression rdfs:label ?te_label_lang . FILTER(LANG(?te_label_lang) = "${escapedLanguage}") }
                    OPTIONAL { ?target_expression rdfs:label ?te_label_none . FILTER(LANG(?te_label_none) = "") }
                    BIND(COALESCE(?te_label_lang, ?te_label_none) AS ?target_expression_title)
                    FILTER(BOUND(?target_expression_title))
                    ?expression_to_expression_relationship rdfs:label ?expression_to_expression_relationship_label .
                    FILTER(LANG(?expression_to_expression_relationship_label) = "${escapedLanguage}") .
                }
            } UNION {
                OPTIONAL {
                    ?target_expression ?expression_to_expression_relationship ?expression .
                    ?target_expression a <http://rdaregistry.info/Elements/c/C10006> .
                    OPTIONAL { ?target_expression rdfs:label ?te_label_lang2 . FILTER(LANG(?te_label_lang2) = "${escapedLanguage}") }
                    OPTIONAL { ?target_expression rdfs:label ?te_label_none2 . FILTER(LANG(?te_label_none2) = "") }
                    BIND(COALESCE(?te_label_lang2, ?te_label_none2) AS ?target_expression_title)
                    FILTER(BOUND(?target_expression_title))
                    ?expression_to_expression_relationship_inverse owl:inverseOf ?expression_to_expression_relationship .
                    ?expression_to_expression_relationship_inverse rdfs:label ?expression_to_expression_relationship_label .
                    FILTER(LANG(?expression_to_expression_relationship_label) = "${escapedLanguage}") .
                }
            }
        }
        GROUP BY ?expression ?expression_to_expression_relationship_label
    }
}
GROUP BY ?expression
      `;

      const detailResponse = await client.query(detailQuery);

      // Build a map from expression URI → detail bindings
      const detailMap = new Map<string, typeof detailResponse.results.bindings[0]>();
      for (const binding of detailResponse.results.bindings) {
        detailMap.set(binding.expression.value, binding);
      }

      // Return results in the original score order from phase 1
      return expressionUris.map((uri) => {
        const binding = detailMap.get(uri);
        return {
          uri,
          expression_title: binding?.expression_title?.value,
          work_title: binding?.work_title?.value,
          work_creators: binding?.work_creators?.value,
          expression_creators: binding?.expression_creators?.value,
          language: binding?.language?.value,
          contenttype: binding?.contenttype?.value,
          contenttypeUri: binding?.contenttype_uri?.value,
          workcategory: binding?.workcategory?.value,
          genre: binding?.genre?.value,
          work_to_work_relationships: binding?.work_to_work_relationships?.value,
          expression_to_expression_relationships:
            binding?.expression_to_expression_relationships?.value,
          manifestation_count: binding?.manifestation_count
            ? parseInt(binding.manifestation_count.value, 10)
            : undefined,
          score: scoreMap.get(uri),
        };
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < SEARCH_PAGE_SIZE) return undefined;
      return lastPageParam + SEARCH_PAGE_SIZE;
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
  return useInfiniteQuery({
    queryKey: ["searchManifestations", config.url, query, language],
    queryFn: async ({ pageParam = 0 }): Promise<ManifestationSearchResult[]> => {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const client = new SparqlClient(config);
      const escapedQuery = escapeSparqlLiteral(query);
      const escapedLanguage = escapeSparqlLiteral(language);

      // Phase 1: Lightweight Lucene search — just URIs and scores
      const searchQuery = `
PREFIX lucene: <http://www.ontotext.com/connectors/lucene#>
PREFIX inst: <http://www.ontotext.com/connectors/lucene/instance#>

SELECT ?manifestation ?score
FROM <http://www.ontotext.com/explicit>
WHERE {
    ?search a inst:manifestationsIndex ;
        lucene:query "${escapedQuery}" ;
        lucene:entities ?manifestation .
    ?manifestation lucene:score ?score .
    ?manifestation a <http://rdaregistry.info/Elements/c/C10007> .
}
ORDER BY DESC(?score)
LIMIT ${SEARCH_PAGE_SIZE}
OFFSET ${pageParam}
      `;

      const searchResponse = await client.query(searchQuery);
      const hits = searchResponse.results.bindings;

      if (hits.length === 0) return [];

      const manifestationUris: string[] = [];
      const scoreMap = new Map<string, number>();

      for (const hit of hits) {
        const uri = hit.manifestation.value;
        if (!scoreMap.has(uri)) {
          manifestationUris.push(uri);
          scoreMap.set(uri, parseFloat(hit.score.value));
        }
      }

      // Phase 2: Fetch details for just this page's URIs
      const detailQuery = `
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdamd: <http://rdaregistry.info/Elements/m/datatype/>
PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>
PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>

SELECT ?manifestation
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
    (SAMPLE(?mediatype_uri_val) as ?mediatype_uri)
    (SAMPLE(?carriertype_label) as ?carriertype)
    (SAMPLE(?carriertype_uri_val) as ?carriertype_uri)
    (GROUP_CONCAT(DISTINCT CONCAT(?manifestation_agent_relationship_label, "${SPARQL_SEP.LABEL}", ?manifestation_agent_names) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?manifestation_creators)
    (COUNT(DISTINCT ?expression) as ?expression_count)
FROM <http://www.ontotext.com/explicit>
WHERE {
    ${buildValuesClause("?manifestation", manifestationUris)}

    # Manifestation → expression count
    OPTIONAL {
        { ?manifestation rdamo:P30139 ?expression . }
        UNION
        { ?expression rdaeo:P20059 ?manifestation . }
    }

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
        FILTER(LANG(?mediatype_label_chosen) = "${escapedLanguage}")
    }
    OPTIONAL {
        ?manifestation rdamo:P30002 ?mediatype_en .
        ?mediatype_en rdfs:label ?mediatype_label_en .
        FILTER(LANG(?mediatype_label_en) = "en")
    }
    BIND(COALESCE(?mediatype_label_chosen, ?mediatype_label_en) AS ?mediatype_label)
    BIND(COALESCE(?mediatype_chosen, ?mediatype_en) AS ?mediatype_uri_val)

    # Carrier type with language fallback
    OPTIONAL {
        ?manifestation rdamo:P30001 ?carriertype_chosen .
        ?carriertype_chosen rdfs:label ?carriertype_label_chosen .
        FILTER(LANG(?carriertype_label_chosen) = "${escapedLanguage}")
    }
    OPTIONAL {
        ?manifestation rdamo:P30001 ?carriertype_en .
        ?carriertype_en rdfs:label ?carriertype_label_en .
        FILTER(LANG(?carriertype_label_en) = "en")
    }
    BIND(COALESCE(?carriertype_label_chosen, ?carriertype_label_en) AS ?carriertype_label)
    BIND(COALESCE(?carriertype_chosen, ?carriertype_en) AS ?carriertype_uri_val)

    # Manifestation to agent relationships
    OPTIONAL {
        SELECT DISTINCT ?manifestation ?manifestation_agent_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?manifestation_agent_name_x, "${SPARQL_SEP.URI}", STR(?manifestation_agent)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?manifestation_agent_names)
        WHERE {
            {
                OPTIONAL {
                    ?manifestation ?manifestation_agent_relationship ?manifestation_agent .
                    ?manifestation_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?manifestation_agent_name_x .
                    ?manifestation_agent_relationship rdfs:label ?manifestation_agent_relationship_label .
                    FILTER(LANG(?manifestation_agent_relationship_label) = "${escapedLanguage}") .
                }
            } UNION {
                OPTIONAL {
                    ?manifestation_agent ?manifestation_agent_relationship ?manifestation .
                    ?manifestation_agent <http://rdaregistry.info/Elements/a/datatype/P50385> ?manifestation_agent_name_x .
                    ?manifestation_agent_relationship_inverse owl:inverseOf ?manifestation_agent_relationship .
                    ?manifestation_agent_relationship_inverse rdfs:label ?manifestation_agent_relationship_label .
                    FILTER(LANG(?manifestation_agent_relationship_label) = "${escapedLanguage}") .
                }
            }
        }
        GROUP BY ?manifestation ?manifestation_agent_relationship_label
    }
}
GROUP BY ?manifestation
      `;

      const detailResponse = await client.query(detailQuery);

      // Build a map from manifestation URI → detail bindings
      const detailMap = new Map<string, typeof detailResponse.results.bindings[0]>();
      for (const binding of detailResponse.results.bindings) {
        detailMap.set(binding.manifestation.value, binding);
      }

      // Return results in the original score order from phase 1
      return manifestationUris.map((uri) => {
        const binding = detailMap.get(uri);
        return {
          uri,
          title: binding?.title?.value,
          other: binding?.other?.value,
          responsibilityStatement: binding?.responsibilityStatement?.value,
          edition: binding?.edition?.value,
          place: binding?.place?.value,
          publisher: binding?.publisher?.value,
          date: binding?.date?.value,
          extent: binding?.extent?.value,
          dimensions: binding?.dimensions?.value,
          series: binding?.series?.value,
          seriesNumbering: binding?.seriesNumbering?.value,
          notes: binding?.notes?.value,
          identifiers: binding?.identifiers?.value,
          mediatype: binding?.mediatype?.value,
          mediatypeUri: binding?.mediatype_uri?.value,
          carriertype: binding?.carriertype?.value,
          carriertypeUri: binding?.carriertype_uri?.value,
          manifestation_creators: binding?.manifestation_creators?.value,
          expression_count: binding?.expression_count
            ? parseInt(binding.expression_count.value, 10)
            : undefined,
        };
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < SEARCH_PAGE_SIZE) return undefined;
      return lastPageParam + SEARCH_PAGE_SIZE;
    },
    enabled: Boolean(query && query.trim().length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
