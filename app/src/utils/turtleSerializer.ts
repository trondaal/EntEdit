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
  ["http://rdaregistry.info/Elements/c/", "rdaw"],
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
): string {
  if (binding.type === "uri") {
    return `<${binding.value}>`;
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

/**
 * Serializes SPARQL bindings for a single subject into formatted Turtle.
 *
 * @param subjectUri - The URI of the entity being exported
 * @param bindings - SPARQL result bindings with `predicate` and `object` variables
 * @returns Formatted Turtle string
 */
export function serializeToTurtle(
  subjectUri: string,
  bindings: Array<{ predicate: SparqlBinding; object: SparqlBinding }>,
): string {
  // 1. Collect all URIs and build the prefix map
  const usedNamespaces = new Map<string, string>(); // namespace → prefix
  const prefixToNamespace = new Map<string, string>(); // prefix → namespace
  let autoCounter = 0;

  function registerUri(uri: string) {
    const ns = extractNamespace(uri);
    if (!ns || usedNamespaces.has(ns)) return;

    // Check if this namespace has a known prefix
    const knownPrefix = KNOWN_PREFIXES.get(ns);
    if (knownPrefix && !prefixToNamespace.has(knownPrefix)) {
      usedNamespaces.set(ns, knownPrefix);
      prefixToNamespace.set(knownPrefix, ns);
    } else if (!knownPrefix) {
      // Auto-generate prefix for unknown namespaces
      let prefix: string;
      do {
        prefix = `ns${autoCounter++}`;
      } while (prefixToNamespace.has(prefix));
      usedNamespaces.set(ns, prefix);
      prefixToNamespace.set(prefix, ns);
    }
  }

  // Register only predicate and datatype URIs (subject and objects stay as full URIs)
  for (const b of bindings) {
    registerUri(b.predicate.value);
    if (
      b.object.datatype &&
      b.object.datatype !== "http://www.w3.org/2001/XMLSchema#string"
    ) {
      registerUri(b.object.datatype);
    }
  }

  // 2. Group bindings by predicate
  const grouped = new Map<string, SparqlBinding[]>();
  for (const b of bindings) {
    const pred = b.predicate.value;
    if (!grouped.has(pred)) grouped.set(pred, []);
    grouped.get(pred)!.push(b.object);
  }

  // 3. Sort predicates: rdf:type first, rdfs:label second, then alphabetically by compact name
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

  const predicateOrder = [...grouped.keys()].sort((a, b) => {
    if (a === RDF_TYPE) return -1;
    if (b === RDF_TYPE) return 1;
    if (a === RDFS_LABEL) return -1;
    if (b === RDFS_LABEL) return 1;
    const aCompact = compactUri(a, usedNamespaces);
    const bCompact = compactUri(b, usedNamespaces);
    return aCompact.localeCompare(bCompact);
  });

  // 4. Build prefix declarations
  const sortedPrefixes = [...prefixToNamespace.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const prefixLines = sortedPrefixes.map(
    ([prefix, ns]) => `@prefix ${prefix}: <${ns}> .`,
  );

  // 5. Build the subject block using property list notation
  const subjectCompact = `<${subjectUri}>`;
  const propertyLines: string[] = [];

  for (let i = 0; i < predicateOrder.length; i++) {
    const pred = predicateOrder[i];
    const objects = grouped.get(pred)!;
    const predCompact =
      pred === RDF_TYPE ? "a" : compactUri(pred, usedNamespaces);
    const objectStrings = objects.map((obj) =>
      serializeObject(obj, usedNamespaces),
    );

    const separator = i < predicateOrder.length - 1 ? " ;" : " .";

    if (objectStrings.length === 1) {
      propertyLines.push(`    ${predCompact} ${objectStrings[0]}${separator}`);
    } else {
      // Multiple objects: one per line with comma separation
      const lastIdx = objectStrings.length - 1;
      propertyLines.push(`    ${predCompact}`);
      objectStrings.forEach((obj, j) => {
        const objSep = j < lastIdx ? " ," : separator;
        propertyLines.push(`        ${obj}${objSep}`);
      });
    }
  }

  // 6. Assemble the full Turtle document
  const parts: string[] = [];
  if (prefixLines.length > 0) {
    parts.push(prefixLines.join("\n"));
    parts.push("");
  }
  parts.push(subjectCompact);
  parts.push(...propertyLines);

  return parts.join("\n") + "\n";
}
