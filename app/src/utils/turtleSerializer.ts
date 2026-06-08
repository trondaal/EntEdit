import type { SparqlBinding } from "../types/sparql";

/**
 * Well-known namespace prefixes.
 * Maps namespace URI (ending in # or /) → preferred prefix name.
 * Used to generate consistent prefixes across separate Turtle exports.
 */
export const KNOWN_PREFIXES: ReadonlyMap<string, string> = new Map([
  // W3C core
  ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf"],
  ["http://www.w3.org/2000/01/rdf-schema#", "rdfs"],
  ["http://www.w3.org/2002/07/owl#", "owl"],
  ["http://www.w3.org/2001/XMLSchema#", "xsd"],
  ["http://www.w3.org/2004/02/skos/core#", "skos"],
  // Dublin Core
  ["http://purl.org/dc/terms/", "dcterms"],
  ["http://purl.org/dc/elements/1.1/", "dc"],
  // Other common
  ["https://schema.org/", "schema"],
  ["http://xmlns.com/foaf/0.1/", "foaf"],
  // EntEdit
  ["http://oslomet.no/abi/vocab#", "entedit"],
  //RDA Classes
  ["http://rdaregistry.info/Elements/c/", "rdac"],
  // RDA object property namespaces
  ["http://rdaregistry.info/Elements/w/", "rdaw"],
  ["http://rdaregistry.info/Elements/e/", "rdae"],
  ["http://rdaregistry.info/Elements/m/", "rdam"],
  ["http://rdaregistry.info/Elements/i/", "rdai"],
  ["http://rdaregistry.info/Elements/a/", "rdaa"],
  ["http://rdaregistry.info/Elements/n/", "rdan"],
  ["http://rdaregistry.info/Elements/p/", "rdap"],
  ["http://rdaregistry.info/Elements/t/", "rdat"],
  ["http://rdaregistry.info/Elements/x/", "rdax"],
  // RDA datatype property namespaces
  ["http://rdaregistry.info/Elements/w/datatype/", "rdawd"],
  ["http://rdaregistry.info/Elements/e/datatype/", "rdaed"],
  ["http://rdaregistry.info/Elements/m/datatype/", "rdamd"],
  ["http://rdaregistry.info/Elements/i/datatype/", "rdaid"],
  ["http://rdaregistry.info/Elements/a/datatype/", "rdaad"],
  ["http://rdaregistry.info/Elements/n/datatype/", "rdand"],
  ["http://rdaregistry.info/Elements/p/datatype/", "rdapd"],
  ["http://rdaregistry.info/Elements/t/datatype/", "rdatd"],
  ["http://rdaregistry.info/Elements/x/datatype/", "rdaxd"],
  // RDA object property namespaces (explicit /object/ path)
  ["http://rdaregistry.info/Elements/w/object/", "rdawo"],
  ["http://rdaregistry.info/Elements/e/object/", "rdaeo"],
  ["http://rdaregistry.info/Elements/m/object/", "rdamo"],
  ["http://rdaregistry.info/Elements/i/object/", "rdaio"],
  ["http://rdaregistry.info/Elements/a/object/", "rdaao"],
  ["http://rdaregistry.info/Elements/n/object/", "rdano"],
  ["http://rdaregistry.info/Elements/p/object/", "rdapo"],
  ["http://rdaregistry.info/Elements/t/object/", "rdato"],
  ["http://rdaregistry.info/Elements/x/object/", "rdaxo"],
  // RDA term lists
  ["http://rdaregistry.info/termList/", "rdaco"],
  // IFLA
  ["http://iflastandards.info/ns/lrm/lrmer/", "lrm"],
  ["http://iflastandards.info/ns/fr/frbr/frbrer/", "frbr"],
]);

/**
 * Extracts the namespace from a URI by splitting at the last # or /.
 * This is the canonical split used consistently for both registration
 * and compaction.
 */
function extractNamespace(uri: string): string | null {
  const hashIdx = uri.lastIndexOf("#");
  if (hashIdx >= 0) return uri.slice(0, hashIdx + 1);
  const slashIdx = uri.lastIndexOf("/");
  if (slashIdx >= 0) return uri.slice(0, slashIdx + 1);
  return null;
}

function serializeObject(
  binding: SparqlBinding,
  namespaceToPrefixMap: Map<string, string>,
  compactUriValue = false,
): string {
  if (binding.type === "uri") {
    return compactUriValue
      ? compactUri(binding.value, namespaceToPrefixMap)
      : `<${binding.value}>`;
  }
  if (binding.type === "bnode") {
    return `_:${binding.value}`;
  }
  // Literal
  const escaped = binding.value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

  if (binding["xml:lang"]) {
    return `"${escaped}"@${binding["xml:lang"]}`;
  }
  if (
    binding.datatype &&
    binding.datatype !== "http://www.w3.org/2001/XMLSchema#string"
  ) {
    const datatypeCompact = compactUri(binding.datatype, namespaceToPrefixMap);
    return `"${escaped}"^^${datatypeCompact}`;
  }
  return `"${escaped}"`;
}

function compactUri(
  uri: string,
  namespaceToPrefixMap: Map<string, string>,
): string {
  const ns = extractNamespace(uri);
  if (ns && namespaceToPrefixMap.has(ns)) {
    const prefix = namespaceToPrefixMap.get(ns)!;
    const local = uri.slice(ns.length);
    if (local && /^[a-zA-Z_][a-zA-Z0-9._-]*$/.test(local)) {
      return `${prefix}:${local}`;
    }
  }
  return `<${uri}>`;
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

type PredObjBinding = { predicate: SparqlBinding; object: SparqlBinding };

/**
 * Builds a fresh prefix registry. Returns the namespace→prefix map (used for
 * compaction) plus a `register` function for adding URIs as they are seen.
 */
function createPrefixRegistry() {
  const usedNamespaces = new Map<string, string>(); // namespace → prefix
  const prefixToNamespace = new Map<string, string>(); // prefix → namespace
  let autoCounter = 0;

  function register(uri: string) {
    const ns = extractNamespace(uri);
    if (!ns || usedNamespaces.has(ns)) return;

    const knownPrefix = KNOWN_PREFIXES.get(ns);
    if (knownPrefix && !prefixToNamespace.has(knownPrefix)) {
      usedNamespaces.set(ns, knownPrefix);
      prefixToNamespace.set(knownPrefix, ns);
    } else if (!knownPrefix) {
      let prefix: string;
      do {
        prefix = `ns${autoCounter++}`;
      } while (prefixToNamespace.has(prefix));
      usedNamespaces.set(ns, prefix);
      prefixToNamespace.set(prefix, ns);
    }
  }

  return { usedNamespaces, prefixToNamespace, register };
}

function registerBindingNamespaces(
  bindings: PredObjBinding[],
  register: (uri: string) => void,
) {
  for (const b of bindings) {
    register(b.predicate.value);
    // Register class URI namespaces so rdf:type objects can be compacted
    if (b.predicate.value === RDF_TYPE && b.object.type === "uri") {
      register(b.object.value);
    }
    if (
      b.object.datatype &&
      b.object.datatype !== "http://www.w3.org/2001/XMLSchema#string"
    ) {
      register(b.object.datatype);
    }
  }
}

/**
 * Builds the property-list block (lines after the subject) for a single
 * subject. Does not include the subject line itself or the prefix header.
 */
function buildSubjectBlock(
  bindings: PredObjBinding[],
  usedNamespaces: Map<string, string>,
): string[] {
  // Group bindings by predicate
  const grouped = new Map<string, SparqlBinding[]>();
  for (const b of bindings) {
    const pred = b.predicate.value;
    if (!grouped.has(pred)) grouped.set(pred, []);
    grouped.get(pred)!.push(b.object);
  }

  // Sort predicates: rdf:type first, rdfs:label second, then alphabetically by compact name
  const predicateOrder = [...grouped.keys()].sort((a, b) => {
    if (a === RDF_TYPE) return -1;
    if (b === RDF_TYPE) return 1;
    if (a === RDFS_LABEL) return -1;
    if (b === RDFS_LABEL) return 1;
    const aCompact = compactUri(a, usedNamespaces);
    const bCompact = compactUri(b, usedNamespaces);
    return aCompact.localeCompare(bCompact);
  });

  const propertyLines: string[] = [];
  for (let i = 0; i < predicateOrder.length; i++) {
    const pred = predicateOrder[i];
    const objects = grouped.get(pred)!;
    const predCompact =
      pred === RDF_TYPE ? "a" : compactUri(pred, usedNamespaces);
    const objectStrings = objects.map((obj) =>
      serializeObject(obj, usedNamespaces, pred === RDF_TYPE),
    );

    const separator = i < predicateOrder.length - 1 ? " ;" : " .";

    if (objectStrings.length === 1) {
      propertyLines.push(`    ${predCompact} ${objectStrings[0]}${separator}`);
    } else {
      const lastIdx = objectStrings.length - 1;
      propertyLines.push(`    ${predCompact}`);
      objectStrings.forEach((obj, j) => {
        const objSep = j < lastIdx ? " ," : separator;
        propertyLines.push(`        ${obj}${objSep}`);
      });
    }
  }

  return propertyLines;
}

function buildPrefixLines(prefixToNamespace: Map<string, string>): string[] {
  const sortedPrefixes = [...prefixToNamespace.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  return sortedPrefixes.map(
    ([prefix, ns]) => `@prefix ${prefix}: <${ns}> .`,
  );
}

/**
 * Serializes SPARQL bindings for a single subject into formatted Turtle.
 */
export function serializeToTurtle(
  subjectUri: string,
  bindings: PredObjBinding[],
): string {
  const subjectMap = new Map<string, PredObjBinding[]>();
  subjectMap.set(subjectUri, bindings);
  return serializeGraphToTurtle(subjectMap);
}

/**
 * Serializes multiple subjects into a single formatted Turtle document.
 * Prefixes are collected once across all subjects and emitted in a shared
 * header. Subjects are written in the order they appear in `subjectBindings`.
 */
export function serializeGraphToTurtle(
  subjectBindings: Map<string, PredObjBinding[]>,
): string {
  const { usedNamespaces, prefixToNamespace, register } = createPrefixRegistry();

  // Register predicate and datatype URIs across all subjects
  for (const bindings of subjectBindings.values()) {
    registerBindingNamespaces(bindings, register);
  }

  const prefixLines = buildPrefixLines(prefixToNamespace);

  const parts: string[] = [];
  if (prefixLines.length > 0) {
    parts.push(prefixLines.join("\n"));
    parts.push("");
  }

  let first = true;
  for (const [subjectUri, bindings] of subjectBindings) {
    if (!first) parts.push("");
    first = false;
    parts.push(`<${subjectUri}>`);
    parts.push(...buildSubjectBlock(bindings, usedNamespaces));
  }

  return parts.join("\n") + "\n";
}
