/**
 * Detail queries for expressions and manifestations, shared by the search
 * result pages and the expandable lists under a result.
 *
 * Every query is built around a *scope*: a SPARQL pattern that binds the
 * entities to describe (`?expression` or `?manifestation`), either the hits of
 * a search page (`expressionScope`/`manifestationScope`) or the entities linked
 * to one parent (`expressionsOfManifestation`/`manifestationsOfExpression`).
 *
 * The scope is repeated inside every grouped subquery. SPARQL evaluates a
 * subquery on its own, before joining it with the outer pattern, so a subquery
 * that does not bind its entities itself — e.g. "all agents of all works" —
 * is computed for the whole repository on every call. With 650k triples that
 * cost about 4.5 s per search page regardless of the search term.
 */
import { escapeSparqlLiteral, sanitizeSparqlUri } from "./labelUtils";
import { SPARQL_SEP } from "./textFormatters";
import type { SparqlResult } from "../types/sparql";

const uriList = (uris: string[]): string =>
  uris.map((uri) => `<${sanitizeSparqlUri(uri)}>`).join(" ");

/** Scope binding `?expression` to the given URIs. */
export const expressionScope = (uris: string[]): string =>
  `VALUES ?expression { ${uriList(uris)} }`;

/** Scope binding `?manifestation` to the given URIs. */
export const manifestationScope = (uris: string[]): string =>
  `VALUES ?manifestation { ${uriList(uris)} }`;

/** Scope binding `?expression` to the expressions embodied in a manifestation. */
export const expressionsOfManifestation = (manifestationUri: string): string => {
  const m = `<${sanitizeSparqlUri(manifestationUri)}>`;
  return `{ ${m} rdamo:P30139 ?expression } UNION { ?expression rdaeo:P20059 ${m} }`;
};

/**
 * Order of the expressions within a manifestation (its contents), as set in
 * the editor: the `entedit:valueOrder` annotation on the manifestation's own
 * statement. A link stated only from the expression (rdaeo:P20059) has none.
 */
export const expressionOrderInManifestation = (manifestationUri: string): string =>
  `OPTIONAL { << <${sanitizeSparqlUri(manifestationUri)}> rdamo:P30139 ?expression >> entedit:valueOrder ?value_order }`;

/** Scope binding `?manifestation` to the manifestations of an expression. */
export const manifestationsOfExpression = (expressionUri: string): string => {
  const e = `<${sanitizeSparqlUri(expressionUri)}>`;
  return `{ ${e} rdaeo:P20059 ?manifestation } UNION { ?manifestation rdamo:P30139 ${e} }`;
};

/**
 * Links `?expression` to its work, stated from either side, as `?${work}`.
 * Each block that needs the work links to it on its own, under its own
 * variable: see `buildExpressionDetailQuery` for why `?work` is never shared.
 */
const workOf = (work: string): string =>
  `{ ?expression rdaeo:P20231 ?${work} } UNION { ?${work} rdawo:P10078 ?expression }`;

const PREFIXES = `
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdaad: <http://rdaregistry.info/Elements/a/datatype/>
PREFIX rdaed: <http://rdaregistry.info/Elements/e/datatype/>
PREFIX rdaeo: <http://rdaregistry.info/Elements/e/object/>
PREFIX rdawd: <http://rdaregistry.info/Elements/w/datatype/>
PREFIX rdawo: <http://rdaregistry.info/Elements/w/object/>
PREFIX rdamd: <http://rdaregistry.info/Elements/m/datatype/>
PREFIX rdamo: <http://rdaregistry.info/Elements/m/object/>
PREFIX entedit: <http://oslomet.no/abi/vocab#>
`;

/**
 * Agents related to `?entity` in either direction, grouped per result row
 * (`?key`) and relationship label: "label ‡ name ‖ uri † name ‖ uri". An
 * incoming statement is shown with the label of its inverse property.
 * `entity` differs from `key` for the agents of an expression's work.
 */
const agentsSubquery = (entity: string, key: string, scope: string, lang: string): string => `
    OPTIONAL {
        SELECT ?${key} ?${entity}_agent_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?agent_name, "${SPARQL_SEP.URI}", STR(?agent)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?${entity}_agent_names)
        WHERE {
            ${scope}
            {
                ?${entity} ?relationship ?agent .
                ?agent rdaad:P50413 ?agent_name .
                ?relationship rdfs:label ?${entity}_agent_relationship_label .
            } UNION {
                ?agent ?relationship ?${entity} .
                ?agent rdaad:P50413 ?agent_name .
                ?inverse owl:inverseOf ?relationship .
                ?inverse rdfs:label ?${entity}_agent_relationship_label .
            }
            FILTER(LANG(?${entity}_agent_relationship_label) = "${lang}")
        }
        GROUP BY ?${key} ?${entity}_agent_relationship_label
    }`;

/**
 * Relationships from `?entity` to other entities of `targetClass`, in either
 * direction, grouped per result row (`?key`) and relationship label: "label ‡ title ‖ uri † …".
 * Relationship properties marked `entedit:display false` are left out; an
 * incoming statement is shown with (and filtered by) its inverse property.
 *
 * The target title is the `rdfs:label` in the chosen language, else the
 * untagged one, sampled per target first — a target with two untagged labels
 * (stale data) would otherwise be listed twice.
 */
const relationshipsSubquery = (
  entity: string,
  key: string,
  scope: string,
  targetClass: string,
  lang: string,
): string => `
    OPTIONAL {
        SELECT ?${key} ?${entity}_relationship_label
        (GROUP_CONCAT(DISTINCT CONCAT(?target_title, "${SPARQL_SEP.URI}", STR(?target)) ; SEPARATOR="${SPARQL_SEP.NAME}") as ?${entity}_relationship_targets)
        WHERE {
            SELECT ?${key} ?${entity}_relationship_label ?target (SAMPLE(?target_title_raw) as ?target_title)
            WHERE {
                ${scope}
                {
                    ?${entity} ?relationship ?target .
                    ?target a <${targetClass}> .
                    BIND(?relationship AS ?shown)
                } UNION {
                    ?target ?relationship ?${entity} .
                    ?target a <${targetClass}> .
                    ?shown owl:inverseOf ?relationship .
                }
                ?shown rdfs:label ?${entity}_relationship_label .
                FILTER(LANG(?${entity}_relationship_label) = "${lang}")
                FILTER NOT EXISTS { ?shown entedit:display false }
                OPTIONAL { ?target rdfs:label ?label_lang . FILTER(LANG(?label_lang) = "${lang}") }
                OPTIONAL { ?target rdfs:label ?label_none . FILTER(LANG(?label_none) = "") }
                BIND(COALESCE(?label_lang, ?label_none) AS ?target_title_raw)
                FILTER(BOUND(?target_title_raw))
            }
            GROUP BY ?${key} ?${entity}_relationship_label ?target
        }
        GROUP BY ?${key} ?${entity}_relationship_label
    }`;

/** Label of a linked concept in the chosen language; `link` binds `?subject`. */
const conceptLabel = (
  subject: string,
  property: string,
  concept: string,
  label: string,
  lang: string,
  link = "",
): string => `
    OPTIONAL {
        ${link}
        ?${subject} ${property} ?${concept} .
        ?${concept} rdfs:label ?${label} .
        FILTER(LANG(?${label}) = "${lang}")
    }`;

/**
 * `orderPattern` may bind `?value_order` for each expression (see
 * `expressionOrderInManifestation`); it is returned as `valueOrder`.
 */
export const buildExpressionDetailQuery = (
  scope: string,
  language: string,
  orderPattern = "",
): string => {
  const lang = escapeSparqlLiteral(language);
  return `${PREFIXES}
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
    (GROUP_CONCAT(DISTINCT CONCAT(?work_relationship_label, "${SPARQL_SEP.LABEL}", ?work_relationship_targets) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?work_to_work_relationships)
    (GROUP_CONCAT(DISTINCT CONCAT(?expression_relationship_label, "${SPARQL_SEP.LABEL}", ?expression_relationship_targets) ; SEPARATOR="${SPARQL_SEP.GROUP}") as ?expression_to_expression_relationships)
    (COUNT(DISTINCT ?manifestation) as ?manifestation_count)
    (MIN(?value_order) as ?valueOrder)
FROM <http://www.ontotext.com/explicit>
WHERE {
    ${scope}
    ${orderPattern}

    # Every work block links to the work itself, under a variable of its own,
    # and the work subqueries group by ?expression. A shared ?work fails both
    # ways: a later pattern on it matches every work in the repository when an
    # expression has none (it is unbound in that row), and nesting the blocks
    # in one OPTIONAL instead makes GraphDB evaluate that group for every
    # expression-work pair before joining (~1 s at 90k expressions).
    OPTIONAL { ${workOf("w_title")} ?w_title rdawd:P10223 ?worktitle }
    ${conceptLabel("w_category", "entedit:P01", "workcategory", "workcategory_label", lang, workOf("w_category"))}
    ${conceptLabel("w_genre", "entedit:P02", "genre_entity", "genre_label", lang, workOf("w_genre"))}
    ${agentsSubquery("work", "expression", `${scope} ${workOf("work")}`, lang)}
    ${relationshipsSubquery("work", "expression", `${scope} ${workOf("work")}`, "http://rdaregistry.info/Elements/c/C10001", lang)}

    OPTIONAL {
        { ?expression rdaeo:P20059 ?manifestation } UNION { ?manifestation rdamo:P30139 ?expression }
    }
    OPTIONAL { ?expression rdaed:P20315 ?expressiontitle }
    ${conceptLabel("expression", "rdaeo:P20006", "language_entity", "language_label", lang)}
    ${conceptLabel("expression", "rdaeo:P20001", "contenttype", "contenttype_label", lang)}
    ${agentsSubquery("expression", "expression", scope, lang)}
    ${relationshipsSubquery("expression", "expression", scope, "http://rdaregistry.info/Elements/c/C10006", lang)}
}
GROUP BY ?expression
`;
};

export interface ExpressionDetail {
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
  /** Position among the contents it was loaded for, if recorded */
  valueOrder?: number;
}

export const toExpressionDetail = (b: SparqlResult): ExpressionDetail => ({
  uri: b.expression.value,
  expression_title: b.expression_title?.value,
  work_title: b.work_title?.value,
  work_creators: b.work_creators?.value || undefined,
  expression_creators: b.expression_creators?.value || undefined,
  language: b.language?.value || undefined,
  contenttype: b.contenttype?.value || undefined,
  contenttypeUri: b.contenttype_uri?.value,
  workcategory: b.workcategory?.value || undefined,
  genre: b.genre?.value || undefined,
  work_to_work_relationships: b.work_to_work_relationships?.value || undefined,
  expression_to_expression_relationships:
    b.expression_to_expression_relationships?.value || undefined,
  manifestation_count: b.manifestation_count
    ? parseInt(b.manifestation_count.value, 10)
    : undefined,
  valueOrder: b.valueOrder ? parseInt(b.valueOrder.value, 10) : undefined,
});

/** Media or carrier type: label in the chosen language, else English. */
const typeWithFallback = (property: string, name: string, lang: string): string => `
    OPTIONAL {
        ?manifestation ${property} ?${name}_chosen .
        ?${name}_chosen rdfs:label ?${name}_label_chosen .
        FILTER(LANG(?${name}_label_chosen) = "${lang}")
    }
    OPTIONAL {
        ?manifestation ${property} ?${name}_en .
        ?${name}_en rdfs:label ?${name}_label_en .
        FILTER(LANG(?${name}_label_en) = "en")
    }
    BIND(COALESCE(?${name}_label_chosen, ?${name}_label_en) AS ?${name}_label)
    BIND(COALESCE(?${name}_chosen, ?${name}_en) AS ?${name}_uri_val)`;

/** Single-valued manifestation statements, one OPTIONAL each. */
const MANIFESTATION_FIELDS: [string, string][] = [
  ["title", "rdamd:P30156"], // title proper
  ["other", "rdamd:P30142"], // other title information
  ["responsibilityStatement", "rdamd:P30117"],
  ["edition", "rdamd:P30107"],
  ["place", "rdamd:P30088"], // place of publication
  ["publisher", "rdamd:P30076"],
  ["date", "rdamd:P30011"], // date of publication
  ["extent", "rdamd:P30182"],
  ["dimensions", "rdamd:P30169"],
  ["series", "rdamd:P30106"],
  ["seriesNumbering", "rdamd:P30165"],
];

export const buildManifestationDetailQuery = (scope: string, language: string): string => {
  const lang = escapeSparqlLiteral(language);
  return `${PREFIXES}
SELECT ?manifestation
    ${MANIFESTATION_FIELDS.map(([f]) => `(SAMPLE(?${f}_val) as ?${f})`).join("\n    ")}
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
    ${scope}
    OPTIONAL {
        { ?manifestation rdamo:P30139 ?expression } UNION { ?expression rdaeo:P20059 ?manifestation }
    }
    ${MANIFESTATION_FIELDS.map(([f, p]) => `OPTIONAL { ?manifestation ${p} ?${f}_val }`).join("\n    ")}
    OPTIONAL { ?manifestation rdamd:P30137 ?note_val }
    OPTIONAL { ?manifestation rdamd:P30004 ?identifier_val }
    ${typeWithFallback("rdamo:P30002", "mediatype", lang)}
    ${typeWithFallback("rdamo:P30001", "carriertype", lang)}
    ${agentsSubquery("manifestation", "manifestation", scope, lang)}
}
GROUP BY ?manifestation
`;
};

export interface ManifestationDetail {
  uri: string;
  title?: string;
  other?: string;
  responsibilityStatement?: string;
  edition?: string;
  place?: string;
  publisher?: string;
  date?: string;
  extent?: string;
  dimensions?: string;
  series?: string;
  seriesNumbering?: string;
  notes?: string;
  identifiers?: string;
  mediatype?: string;
  mediatypeUri?: string;
  carriertype?: string;
  carriertypeUri?: string;
  manifestation_creators?: string;
  expression_count?: number;
}

export const toManifestationDetail = (b: SparqlResult): ManifestationDetail => ({
  uri: b.manifestation.value,
  title: b.title?.value,
  other: b.other?.value,
  responsibilityStatement: b.responsibilityStatement?.value,
  edition: b.edition?.value,
  place: b.place?.value,
  publisher: b.publisher?.value,
  date: b.date?.value,
  extent: b.extent?.value,
  dimensions: b.dimensions?.value,
  series: b.series?.value,
  seriesNumbering: b.seriesNumbering?.value,
  notes: b.notes?.value || undefined,
  identifiers: b.identifiers?.value || undefined,
  mediatype: b.mediatype?.value,
  mediatypeUri: b.mediatype_uri?.value,
  carriertype: b.carriertype?.value,
  carriertypeUri: b.carriertype_uri?.value,
  manifestation_creators: b.manifestation_creators?.value || undefined,
  expression_count: b.expression_count
    ? parseInt(b.expression_count.value, 10)
    : undefined,
});
