/**
 * The editor's entity lists through the `entitiesIndex` Lucene connector
 * (database/lucene_connectors/entities_index.sparql).
 *
 * Sorting every entity of a class by label in SPARQL takes tens of seconds
 * at a million entities; the index sorts, pages, counts and filters in
 * milliseconds. It only decides *which* entities a page holds and in what
 * order. The labels shown come from SPARQL for the page's entities
 * (`buildPageLabelsQuery`), so they follow the language chosen in the
 * application and need no reindexing when it changes.
 */
import { createLanguageFallbackFragment, getFallbackLanguage } from "./sparqlFragments";
import { escapeSparqlLiteral, sanitizeSparqlUri } from "./labelUtils";

const LUCENE = "http://www.ontotext.com/connectors/lucene#";
const INSTANCE = "http://www.ontotext.com/connectors/lucene/instance#";

export const ENTITY_INDEX = "entitiesIndex";

/** Classes the connector indexes: its `types` in entities_index.sparql. */
export const INDEXED_CLASSES: ReadonlySet<string> = new Set(
  ["C10001", "C10002", "C10003", "C10004", "C10005", "C10006", "C10007", "C10008"].map(
    (id) => `http://rdaregistry.info/Elements/c/${id}`,
  ),
);

export const isIndexedClass = (classUri: string): boolean => INDEXED_CLASSES.has(classUri);

/**
 * The text of the filter box as a Lucene query on the label field: every
 * word is required and the last may be unfinished, so "dra" finds "Dragon"
 * while typing. Empty for an empty filter.
 *
 * The index holds the words of a label as the analyzer cut it, so the text
 * is cut the same way: at anything but a letter, a digit, or an apostrophe
 * or full stop inside a word. "High-Rise" becomes `high` and `rise*`; one
 * term `high\-rise*` matches nothing, because a wildcard term is not
 * analyzed and no word of the label is "high-rise". Nothing Lucene treats as
 * syntax survives the cut, so no escaping is needed.
 */
export const toLabelQuery = (filter: string): string => {
  const words = filter
    .toLowerCase()
    .split(/[^\p{L}\p{N}'.]+/u)
    .map((word) => word.replace(/^['.]+|['.]+$/g, ""))
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return words
    .map((word, index) => `+label:${word}${index === words.length - 1 ? "*" : ""}`)
    .join(" ");
};

/** The Lucene query for the entities of a class, narrowed by the filter text. */
export const toEntityQuery = (classUri: string, filter: string): string => {
  const type = `+rdfType:"${classUri.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  const label = toLabelQuery(filter);
  return label ? `${type} ${label}` : type;
};

const PREFIXES = `PREFIX lucene: <${LUCENE}>
PREFIX inst: <${INSTANCE}>`;

/** One page of entities in label order: the IRIs only. */
export const buildEntityPageQuery = (
  classUri: string,
  filter: string,
  limit: number,
  offset: number,
): string => `${PREFIXES}
SELECT ?entity WHERE {
  ?search a inst:${ENTITY_INDEX} ;
      lucene:query "${escapeSparqlLiteral(toEntityQuery(sanitizeSparqlUri(classUri), filter))}" ;
      lucene:orderBy "sortLabel" ;
      lucene:limit "${limit}" ;
      lucene:offset "${offset}" ;
      lucene:entities ?entity .
}`;

/** The number of entities of the class that match the filter; no row when the index is missing. */
export const buildEntityCountQuery = (classUri: string, filter: string): string => `${PREFIXES}
SELECT ?total WHERE {
  ?search a inst:${ENTITY_INDEX} ;
      lucene:query "${escapeSparqlLiteral(toEntityQuery(sanitizeSparqlUri(classUri), filter))}" ;
      lucene:limit "1" ;
      lucene:totalHits ?total .
}`;

/** The build state of the index (`{"status":"BUILT"}`); no row when it does not exist. */
export const ENTITY_INDEX_STATUS_QUERY = `PREFIX : <${LUCENE}>
PREFIX inst: <${INSTANCE}>
SELECT ?status WHERE { inst:${ENTITY_INDEX} :connectorStatus ?status }`;

/** Whether a `connectorStatus` value says the index can answer queries. */
export const isBuilt = (status: string | undefined): boolean => {
  if (!status) return false;
  try {
    return JSON.parse(status).status === "BUILT";
  } catch {
    return false;
  }
};

/** Labels of the given entities in the chosen language (selected → untagged → other language → any label). */
export const buildPageLabelsQuery = (uris: string[], language: string): string => `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?entity (MIN(?label) AS ?label)
WHERE {
  VALUES ?entity { ${uris.map((uri) => `<${sanitizeSparqlUri(uri)}>`).join(" ")} }
${createLanguageFallbackFragment("?entity", language, getFallbackLanguage(language), "label", true, true)}
}
GROUP BY ?entity`;

export interface ListedEntity {
  uri: string;
  label: string;
}

/** Puts the labels on the page's entities, in the order the index gave them. */
export const withLabels = (
  uris: string[],
  labels: ReadonlyMap<string, string>,
): ListedEntity[] => uris.map((uri) => ({ uri, label: labels.get(uri) || uri }));
