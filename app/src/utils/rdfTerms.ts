import { escapeSparqlLiteral, sanitizeSparqlUri } from "./labelUtils";

/** A full RDF term: an IRI, a plain literal, or a language-tagged or typed literal. */
export interface RdfTerm {
  value: string;
  /** True when the value is an IRI rather than a literal. */
  isUri?: boolean;
  /** Language tag of a literal (mutually exclusive with `datatype`). */
  lang?: string;
  /** Datatype IRI of a literal. xsd:string is implicit and never stored here. */
  datatype?: string;
}

const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const RDF_LANG_STRING = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";
/** BCP 47 shape accepted by SPARQL's LANGTAG production. */
const LANG_TAG = /^[a-zA-Z]+(-[a-zA-Z0-9]+)*$/;

/**
 * Normalizes what a SPARQL JSON binding reports into an `RdfTerm`, dropping
 * the datatypes that are implicit in Turtle/SPARQL syntax (xsd:string for
 * plain literals, rdf:langString for language-tagged ones).
 */
export const termFromBinding = (binding: {
  type: string;
  value: string;
  "xml:lang"?: string;
  datatype?: string;
}): RdfTerm => {
  if (binding.type === "uri") return { value: binding.value, isUri: true };
  const lang = binding["xml:lang"];
  if (lang) return { value: binding.value, lang };
  const datatype = binding.datatype;
  if (datatype && datatype !== XSD_STRING && datatype !== RDF_LANG_STRING) {
    return { value: binding.value, datatype };
  }
  return { value: binding.value };
};

/**
 * Renders a term as SPARQL syntax. Throws for an IRI (or datatype IRI) that
 * cannot be interpolated safely; a malformed language tag is dropped rather
 * than producing an invalid query.
 */
export const serializeTerm = (term: RdfTerm): string => {
  if (term.isUri) return `<${sanitizeSparqlUri(term.value)}>`;
  const literal = `"${escapeSparqlLiteral(term.value)}"`;
  if (term.lang && LANG_TAG.test(term.lang)) return `${literal}@${term.lang}`;
  if (term.datatype && term.datatype !== XSD_STRING) {
    return `${literal}^^<${sanitizeSparqlUri(term.datatype)}>`;
  }
  return literal;
};

/**
 * Identity of a term for diffing: two terms with the same key denote the same
 * RDF term, so one can replace the other without a write.
 */
export const termKey = (term: RdfTerm): string =>
  term.isUri
    ? `u:${term.value}`
    : `l:${term.lang ?? ""}:${term.datatype ?? ""}:${term.value}`;
