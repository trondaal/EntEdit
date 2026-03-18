#!/usr/bin/env npx tsx
/**
 * RDF/XML to Turtle converter
 *
 * Converts RDF/XML files to readable Turtle format, preserving the namespace
 * prefixes defined in the source XML. Produces compact Turtle using property
 * lists (semicolons) and object lists (commas) for readability.
 *
 * Usage:
 *   npx tsx rdf-to-turtle.ts <input.rdf> [output.ttl]
 *
 * If no output file is specified the result is written to stdout.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import sax from "sax";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single RDF triple value (object position). */
interface RdfObject {
  type: "uri" | "literal";
  value: string;
  lang?: string;
  datatype?: string;
}

/** All triples for one subject, grouped by predicate. */
interface Subject {
  uri: string;
  /** The rdf:type derived from the XML element name (if not rdf:Description). */
  rdfType?: string;
  /** predicate URI → list of objects */
  predicates: Map<string, RdfObject[]>;
  /** Insertion order of predicate URIs so output is stable. */
  predicateOrder: string[];
}

// Well-known namespace for rdf:
const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

// Prefixes we always know about (used as fallback).
const BUILTIN_PREFIXES: Record<string, string> = {
  rdf: RDF_NS,
  rdfs: RDFS_NS,
  xsd: XSD_NS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a string for use inside a Turtle quoted literal. */
function escapeTurtleString(s: string): string {
  // Use long quotes if the string contains newlines
  if (s.includes("\n") || s.includes("\r")) {
    // Inside """ ... """ only escape backslash and triple-quote
    return s
      .replace(/\\/g, "\\\\")
      .replace(/"""/g, '\\"\\"\\"');
  }
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** Check if a string needs long (triple-quoted) Turtle quotes. */
function needsLongQuotes(s: string): boolean {
  return s.includes("\n") || s.includes("\r");
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface ParseResult {
  /** prefix → namespace IRI */
  prefixes: Map<string, string>;
  /** Ordered list of subjects with their predicate→object maps. */
  subjects: Subject[];
}

function parseRdfXml(xml: string): ParseResult {
  const parser = sax.parser(true, { xmlns: true, trim: false });

  // Prefix map: prefix string → namespace URI.  Populated from xmlns attrs.
  const prefixes = new Map<string, string>(
    Object.entries(BUILTIN_PREFIXES)
  );

  // All subjects in document order.
  const subjects: Subject[] = [];

  // Parser state --------------------------------------------------------
  // Stack of element context:
  //   depth 0 = rdf:RDF wrapper
  //   depth 1 = subject element
  //   depth 2 = predicate element
  //   depth 3+ = nested (parsed type / collection – simplified handling)
  interface StackFrame {
    ns: string;
    local: string;
    attrs: Record<string, string>;
    /** Collected text content for literal properties. */
    text: string;
    depth: number;
  }
  const stack: StackFrame[] = [];

  let currentSubject: Subject | null = null;
  let currentPredicate: string | null = null;
  let currentPredicateAttrs: Record<string, string> = {};

  // Collect xmlns prefixes from every element we encounter.
  function collectPrefixes(node: sax.QualifiedTag) {
    // sax provides ns as Record<string, string> on qualified tags
    if (node.ns) {
      for (const [prefix, uri] of Object.entries(node.ns)) {
        if (prefix && uri && prefix !== "xmlns") {
          prefixes.set(prefix, uri);
        }
      }
    }
  }

  /** Flatten sax QualifiedAttributes to a plain record of expanded-name → value. */
  function flattenAttrs(
    attrs: Record<string, sax.QualifiedAttribute>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [, attr] of Object.entries(attrs)) {
      const key = attr.uri ? attr.uri + attr.local : attr.local;
      result[key] = attr.value;
    }
    return result;
  }

  function addObject(subj: Subject, predUri: string, obj: RdfObject) {
    const existing = subj.predicates.get(predUri);
    if (existing) {
      existing.push(obj);
    } else {
      subj.predicates.set(predUri, [obj]);
      subj.predicateOrder.push(predUri);
    }
  }

  // SAX event handlers ---------------------------------------------------

  parser.onopentag = (node) => {
    const qnode = node as sax.QualifiedTag;
    collectPrefixes(qnode);

    const ns = qnode.uri || "";
    const local = qnode.local;
    const fullUri = ns + local;
    const attrs = flattenAttrs(
      qnode.attributes as Record<string, sax.QualifiedAttribute>
    );
    const depth = stack.length;

    stack.push({ ns, local, attrs, text: "", depth });

    if (depth === 0) {
      // rdf:RDF root – nothing to do
      return;
    }

    if (depth === 1) {
      // Subject element
      const about =
        attrs[RDF_NS + "about"] ?? attrs["about"] ?? undefined;
      if (!about) return; // skip blank nodes for now

      const subj: Subject = {
        uri: about,
        predicates: new Map(),
        predicateOrder: [],
      };

      // If the element is not rdf:Description, the element name is a type.
      if (fullUri !== RDF_NS + "Description") {
        subj.rdfType = fullUri;
      }

      // Handle rdf:type expressed as attribute shorthand
      const typeAttr = attrs[RDF_NS + "type"];
      if (typeAttr) {
        addObject(subj, RDF_NS + "type", { type: "uri", value: typeAttr });
      }

      currentSubject = subj;
      subjects.push(subj);
      return;
    }

    if (depth === 2 && currentSubject) {
      // Predicate element
      currentPredicate = fullUri;
      currentPredicateAttrs = attrs;

      // rdf:resource attribute → object property (URI value)
      const resource =
        attrs[RDF_NS + "resource"] ?? attrs["resource"] ?? undefined;
      if (resource) {
        addObject(currentSubject, fullUri, {
          type: "uri",
          value: resource,
        });
        currentPredicate = null; // already handled
      }
      return;
    }

    // depth >= 3: nested subject inside a predicate (e.g. blank node or
    // inline typed node).  For simplicity we treat the about as a URI ref.
    if (depth >= 3 && currentSubject && currentPredicate) {
      const about = attrs[RDF_NS + "about"] ?? attrs["about"];
      if (about) {
        addObject(currentSubject, currentPredicate, {
          type: "uri",
          value: about,
        });
      }
      // Also parse this as a new subject in its own right
      if (about && fullUri !== RDF_NS + "Description") {
        const nestedSubj: Subject = {
          uri: about,
          rdfType: fullUri,
          predicates: new Map(),
          predicateOrder: [],
        };
        subjects.push(nestedSubj);
      }
    }
  };

  parser.ontext = (text) => {
    if (stack.length > 0) {
      stack[stack.length - 1].text += text;
    }
  };

  parser.oncdata = (cdata) => {
    if (stack.length > 0) {
      stack[stack.length - 1].text += cdata;
    }
  };

  parser.onclosetag = () => {
    const frame = stack.pop();
    if (!frame) return;

    if (frame.depth === 1) {
      // Finished a subject element
      currentSubject = null;
      currentPredicate = null;
      return;
    }

    if (frame.depth === 2 && currentSubject && currentPredicate) {
      // Finished a predicate element – collect literal value
      const text = frame.text;
      if (text) {
        const lang =
          currentPredicateAttrs[
            "http://www.w3.org/XML/1998/namespacelang"
          ] ??
          currentPredicateAttrs["xml:lang"] ??
          undefined;
        const datatype =
          currentPredicateAttrs[RDF_NS + "datatype"] ?? undefined;

        addObject(currentSubject, currentPredicate, {
          type: "literal",
          value: text,
          lang: lang || undefined,
          datatype: datatype || undefined,
        });
      }
      currentPredicate = null;
      currentPredicateAttrs = {};
    }
  };

  parser.onerror = (err) => {
    throw new Error(`XML parse error: ${err.message}`);
  };

  parser.write(xml).close();

  return { prefixes, subjects };
}

// ---------------------------------------------------------------------------
// Turtle serializer
// ---------------------------------------------------------------------------

function serializeToTurtle(result: ParseResult): string {
  const { prefixes, subjects } = result;
  const lines: string[] = [];

  // Build reverse lookup: namespace URI → prefix
  const nsToPrefix = new Map<string, string>();
  for (const [prefix, ns] of prefixes) {
    nsToPrefix.set(ns, prefix);
  }

  // Ensure common prefixes that appear in the data are present
  // (they may have been xmlns-declared on the root element already).

  // Collect all URIs used in the data so we can auto-detect missing prefixes.
  const allUris = new Set<string>();
  for (const subj of subjects) {
    allUris.add(subj.uri);
    if (subj.rdfType) allUris.add(subj.rdfType);
    for (const [pred, objs] of subj.predicates) {
      allUris.add(pred);
      for (const obj of objs) {
        if (obj.type === "uri") allUris.add(obj.value);
        if (obj.datatype) allUris.add(obj.datatype);
      }
    }
  }

  // Filter prefixes to only those actually used in the data (keeps output clean).
  const usedPrefixes = new Map<string, string>();
  for (const uri of allUris) {
    for (const [ns, prefix] of nsToPrefix) {
      if (uri.startsWith(ns) && uri.length > ns.length) {
        usedPrefixes.set(prefix, ns);
      }
    }
  }
  // Always keep rdf if rdf:type is used
  if (usedPrefixes.has("rdf") || subjects.some((s) => s.rdfType)) {
    usedPrefixes.set("rdf", RDF_NS);
  }

  /** Try to shorten a URI to prefix:local form. */
  function shorten(uri: string): string {
    // Special case: rdf:type → a
    if (uri === RDF_NS + "type") return "a";

    // Try each known prefix (prefer longest namespace match)
    let bestPrefix = "";
    let bestNs = "";
    for (const [prefix, ns] of usedPrefixes) {
      if (uri.startsWith(ns) && ns.length > bestNs.length) {
        bestPrefix = prefix;
        bestNs = ns;
      }
    }
    if (bestNs) {
      const local = uri.slice(bestNs.length);
      // Validate that local part is a valid Turtle pname-local (simplified check)
      if (/^[A-Za-z_][A-Za-z0-9._-]*$/.test(local)) {
        return `${bestPrefix}:${local}`;
      }
    }
    return `<${uri}>`;
  }

  /** Format an RDF object value for Turtle output. */
  function formatObject(obj: RdfObject): string {
    if (obj.type === "uri") {
      return shorten(obj.value);
    }
    // Literal
    const escaped = escapeTurtleString(obj.value);
    let lit: string;
    if (needsLongQuotes(obj.value)) {
      lit = `"""${escaped}"""`;
    } else {
      lit = `"${escaped}"`;
    }
    if (obj.lang) {
      lit += `@${obj.lang}`;
    } else if (obj.datatype && obj.datatype !== XSD_NS + "string") {
      lit += `^^${shorten(obj.datatype)}`;
    }
    return lit;
  }

  // -- Emit prefix declarations --
  // Sort prefixes alphabetically for consistent output.
  const sortedPrefixes = [...usedPrefixes.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [prefix, ns] of sortedPrefixes) {
    lines.push(`@prefix ${prefix}: <${ns}> .`);
  }
  if (sortedPrefixes.length > 0) {
    lines.push("");
  }

  // -- Emit subjects --
  for (let si = 0; si < subjects.length; si++) {
    const subj = subjects[si];
    const subjStr = shorten(subj.uri);

    // Build ordered list of predicate-object pairs.
    // Put rdf:type (a) first, then follow document order.
    const pairs: Array<{ pred: string; objs: RdfObject[] }> = [];

    // rdf:type from element name
    if (subj.rdfType) {
      const existingType = subj.predicates.get(RDF_NS + "type");
      const typeObjs: RdfObject[] = [
        { type: "uri", value: subj.rdfType },
        ...(existingType ?? []),
      ];
      pairs.push({ pred: RDF_NS + "type", objs: typeObjs });
    } else if (subj.predicates.has(RDF_NS + "type")) {
      pairs.push({
        pred: RDF_NS + "type",
        objs: subj.predicates.get(RDF_NS + "type")!,
      });
    }

    // Remaining predicates in document order
    for (const predUri of subj.predicateOrder) {
      if (predUri === RDF_NS + "type" && (subj.rdfType || pairs.length > 0 && pairs[0].pred === RDF_NS + "type")) {
        // Already handled above; but merge any additional type values
        continue;
      }
      const objs = subj.predicates.get(predUri)!;
      pairs.push({ pred: predUri, objs });
    }

    if (pairs.length === 0) {
      // Subject with no properties (shouldn't happen normally)
      lines.push(`${subjStr} .`);
    } else if (pairs.length === 1 && pairs[0].objs.length === 1) {
      // Single property, single object – write on one line
      const p = shorten(pairs[0].pred);
      const o = formatObject(pairs[0].objs[0]);
      lines.push(`${subjStr} ${p} ${o} .`);
    } else {
      // Multiple properties – use property list with semicolons
      lines.push(subjStr);
      for (let pi = 0; pi < pairs.length; pi++) {
        const { pred, objs } = pairs[pi];
        const predStr = shorten(pred);
        const isLast = pi === pairs.length - 1;
        const separator = isLast ? " ." : " ;";

        if (objs.length === 1) {
          lines.push(`    ${predStr} ${formatObject(objs[0])}${separator}`);
        } else {
          // Multiple objects for same predicate – use comma-separated object list
          const objStrs = objs.map(formatObject);
          // Check if they fit on one line (< ~100 chars)
          const oneLine = `    ${predStr} ${objStrs.join(" , ")}${separator}`;
          if (oneLine.length <= 100) {
            lines.push(oneLine);
          } else {
            // Multi-line object list
            for (let oi = 0; oi < objStrs.length; oi++) {
              const isLastObj = oi === objStrs.length - 1;
              if (oi === 0) {
                lines.push(
                  `    ${predStr} ${objStrs[oi]}${isLastObj ? separator : " ,"}`
                );
              } else {
                const indent = " ".repeat(predStr.length + 5);
                lines.push(
                  `${indent}${objStrs[oi]}${isLastObj ? separator : " ,"}`
                );
              }
            }
          }
        }
      }
    }

    // Blank line between subjects
    if (si < subjects.length - 1) {
      lines.push("");
    }
  }

  // Final newline
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: npx tsx rdf-to-turtle.ts <input.rdf> [output.ttl]

Converts RDF/XML to Turtle format, preserving namespace prefixes.

Arguments:
  input.rdf    Path to the RDF/XML input file
  output.ttl   Path to write the Turtle output (default: stdout)

Options:
  -h, --help   Show this help message`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : null;

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const xml = fs.readFileSync(inputPath, "utf-8");
  const result = parseRdfXml(xml);
  const turtle = serializeToTurtle(result);

  if (outputPath) {
    fs.writeFileSync(outputPath, turtle, "utf-8");
    console.error(`Wrote ${outputPath}`);
  } else {
    process.stdout.write(turtle);
  }
}

main();
