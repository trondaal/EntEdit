/**
 * The relationships the search results can show, for the dialog that chooses which to
 * see (`RelationshipVisibilityDialog`): the profile's active object properties between
 * two entities of one level, with how many entities of the open repository use each.
 */
import { createSchemaLabelFragment, notDeprecated } from "./sparqlFragments";
import { sanitizeSparqlUri } from "./labelUtils";

const RDA = "http://rdaregistry.info/Elements/";

export type RelationshipLevel = "work" | "expression" | "manifestation";

export const RELATIONSHIP_LEVELS: ReadonlyArray<{ level: RelationshipLevel; classUri: string }> = [
  { level: "work", classUri: `${RDA}c/C10001` },
  { level: "expression", classUri: `${RDA}c/C10006` },
  { level: "manifestation", classUri: `${RDA}c/C10007` },
];

/**
 * The relationships a cataloguer is most likely to want to switch, shown first in each
 * level: part and whole, sequels, adaptations, translations, revisions, reprints.
 * Only those the profile has are listed.
 */
export const COMMON_RELATIONSHIPS: Record<RelationshipLevel, readonly string[]> = {
  work: [
    "w/object/P10147", // has part work
    "w/object/P10019", // is part of work
    "w/object/P10020", // has sequel work
    "w/object/P10122", // has prequel work
    "w/object/P10155", // is adapted as work
    "w/object/P10142", // is adaptation of work
  ].map((path) => `${RDA}${path}`),
  expression: [
    "e/object/P20145", // has part expression
    "e/object/P20074", // is part of expression
    "e/object/P20171", // is translated as
    "e/object/P20141", // is translation of
    "e/object/P20153", // is adapted as expression
    "e/object/P20152", // is adaptation of expression
    "e/object/P20335", // has sequel expression
    "e/object/P20334", // has prequel expression
    "e/object/P20211", // is revised as
    "e/object/P20189", // is revision of
  ].map((path) => `${RDA}${path}`),
  manifestation: [
    "m/object/P30033", // has part manifestation
    "m/object/P30020", // is part of manifestation
    "m/object/P30024", // has equivalent manifestation
    "m/object/P30027", // is accompanied by manifestation
    "m/object/P30038", // is reprinted as manifestation
    "m/object/P30093", // is reprint of manifestation of
  ].map((path) => `${RDA}${path}`),
};

export interface RelationshipEntry {
  uri: string;
  label: string;
}

/** The profile's active object properties from a `classUri` to itself, as the search lines show them. */
export const buildRelationshipListQuery = (classUri: string, language: string): string => `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX entedit: <http://oslomet.no/abi/vocab#>

SELECT DISTINCT ?property ?label
FROM <http://www.ontotext.com/explicit>
WHERE {
  ?property a rdf:Property ;
            entedit:status "object property" ;
            rdfs:domain <${sanitizeSparqlUri(classUri)}> ;
            rdfs:range <${sanitizeSparqlUri(classUri)}> .
  FILTER NOT EXISTS { ?property entedit:display false }
  ${notDeprecated("?property")}
  ${createSchemaLabelFragment("?property", language)}
  FILTER(BOUND(?label))
}
ORDER BY STR(?label)
`;

type Binding = Record<string, { value: string } | undefined>;

export const parseRelationshipList = (bindings: Binding[]): RelationshipEntry[] => {
  const seen = new Map<string, RelationshipEntry>();
  for (const binding of bindings) {
    const uri = binding.property?.value;
    const label = binding.label?.value;
    if (uri && label && !seen.has(uri)) seen.set(uri, { uri, label });
  }
  return [...seen.values()];
};

/**
 * How many entities show each relationship: the ones that state it and, through
 * `owl:inverseOf`, the ones it is stated to from the other side, which is what the
 * search lines do. Explicit statements only, like the lines.
 */
export const buildRelationshipUsageQuery = (uris: readonly string[]): string => `
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?shown (COUNT(DISTINCT ?entity) AS ?n)
FROM <http://www.ontotext.com/explicit>
WHERE {
  VALUES ?shown { ${uris.map((uri) => `<${sanitizeSparqlUri(uri)}>`).join(" ")} }
  { ?entity ?shown ?other }
  UNION
  { ?other ?stated ?entity . ?shown owl:inverseOf ?stated }
}
GROUP BY ?shown
`;

/** Relationship URI → number of entities; a relationship nobody uses is absent from the query result, so it is 0. */
export const parseRelationshipUsage = (
  bindings: Binding[],
  uris: readonly string[],
): Map<string, number> => {
  const usage = new Map<string, number>(uris.map((uri) => [uri, 0]));
  for (const binding of bindings) {
    const uri = binding.shown?.value;
    const n = Number(binding.n?.value);
    if (uri && Number.isFinite(n)) usage.set(uri, n);
  }
  return usage;
};

/** The entries split into the common ones (in their set order) and the rest, in label order. */
export const groupRelationships = (
  entries: readonly RelationshipEntry[],
  level: RelationshipLevel,
): { common: RelationshipEntry[]; others: RelationshipEntry[] } => {
  const byUri = new Map(entries.map((entry) => [entry.uri, entry]));
  const common = COMMON_RELATIONSHIPS[level].flatMap((uri) => {
    const entry = byUri.get(uri);
    return entry ? [entry] : [];
  });
  const commonUris = new Set(common.map((entry) => entry.uri));
  return { common, others: entries.filter((entry) => !commonUris.has(entry.uri)) };
};

/** The entries whose label contains the text (case-insensitive); all of them for an empty filter. */
export const filterRelationships = <T extends RelationshipEntry>(
  entries: readonly T[],
  text: string,
): T[] => {
  const needle = text.trim().toLocaleLowerCase();
  return needle ? entries.filter((entry) => entry.label.toLocaleLowerCase().includes(needle)) : [...entries];
};
