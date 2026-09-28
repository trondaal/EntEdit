import { describe, it, expect } from "vitest";
import { serializeToTurtle, serializeGraphToTurtle } from "./turtleSerializer";
import type { SparqlBinding } from "../types/sparql";

const uri = (value: string): SparqlBinding => ({ type: "uri", value });
const lit = (
  value: string,
  extra: Partial<SparqlBinding> = {},
): SparqlBinding => ({ type: "literal", value, ...extra });

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const WORK_CLASS = "http://rdaregistry.info/Elements/c/C10001";

describe("serializeToTurtle", () => {
  it("emits a prefix header and compacts known predicate/class URIs", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      { predicate: uri(RDF_TYPE), object: uri(WORK_CLASS) },
      { predicate: uri(RDFS_LABEL), object: lit("Blood Meridian", { "xml:lang": "en" }) },
    ]);

    expect(ttl).toContain("@prefix rdac: <http://rdaregistry.info/Elements/c/> .");
    expect(ttl).toContain("@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .");
    // subject stays a full URI; rdf:type renders as `a` with a compacted class
    expect(ttl).toContain("<http://example.org/w1>");
    expect(ttl).toContain("a rdac:C10001");
    expect(ttl).toContain('rdfs:label "Blood Meridian"@en');
  });

  it("orders rdf:type first, then rdfs:label, then alphabetically", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      { predicate: uri("http://oslomet.no/abi/vocab#status"), object: lit("active") },
      { predicate: uri(RDFS_LABEL), object: lit("Label") },
      { predicate: uri(RDF_TYPE), object: uri(WORK_CLASS) },
    ]);
    const typeIdx = ttl.indexOf(" a ");
    const labelIdx = ttl.indexOf("rdfs:label");
    const statusIdx = ttl.indexOf("entedit:status");
    expect(typeIdx).toBeGreaterThan(-1);
    expect(typeIdx).toBeLessThan(labelIdx);
    expect(labelIdx).toBeLessThan(statusIdx);
  });

  it("escapes quotes and newlines in literal objects", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      { predicate: uri(RDFS_LABEL), object: lit('He said "hi"\nbye') },
    ]);
    expect(ttl).toContain('"He said \\"hi\\"\\nbye"');
  });

  it("keeps an object URI from an unknown namespace as a full URI", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      { predicate: uri("http://rdaregistry.info/Elements/w/P10065"), object: uri("http://example.org/e1") },
    ]);
    // predicate gets a prefix, object entity reference stays full
    expect(ttl).toContain("rdaw:P10065 <http://example.org/e1>");
  });

  it("groups multiple values of one predicate with comma separators", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      { predicate: uri(RDFS_LABEL), object: lit("One") },
      { predicate: uri(RDFS_LABEL), object: lit("Two") },
    ]);
    expect(ttl).toContain('"One"');
    expect(ttl).toContain('"Two"');
    expect(ttl).toContain(",");
  });

  it("renders a typed literal with a compacted datatype", () => {
    const ttl = serializeToTurtle("http://example.org/w1", [
      {
        predicate: uri("http://rdaregistry.info/Elements/w/datatype/P10065"),
        object: lit("2024", { datatype: "http://www.w3.org/2001/XMLSchema#gYear" }),
      },
    ]);
    expect(ttl).toContain('"2024"^^xsd:gYear');
  });
});

describe("serializeGraphToTurtle", () => {
  it("emits one shared prefix header for multiple subjects", () => {
    const map = new Map([
      ["http://example.org/w1", [{ predicate: uri(RDF_TYPE), object: uri(WORK_CLASS) }]],
      ["http://example.org/w2", [{ predicate: uri(RDFS_LABEL), object: lit("Second") }]],
    ]);
    const ttl = serializeGraphToTurtle(map);
    // The rdac prefix should be declared exactly once in the header
    expect(ttl.match(/@prefix rdac:/g)?.length).toBe(1);
    expect(ttl).toContain("<http://example.org/w1>");
    expect(ttl).toContain("<http://example.org/w2>");
  });

  it("assigns auto prefixes (ns0, ...) to unknown predicate namespaces", () => {
    const map = new Map([
      ["http://example.org/w1", [{ predicate: uri("http://unknown.example/vocab#prop"), object: lit("x") }]],
    ]);
    const ttl = serializeGraphToTurtle(map);
    expect(ttl).toContain("@prefix ns0: <http://unknown.example/vocab#> .");
    expect(ttl).toContain("ns0:prop");
  });
});

describe("value order", () => {
  const TITLE = "http://rdaregistry.info/Elements/w/datatype/P10223";
  const bindings = [
    { predicate: uri(TITLE), object: lit("Alpha"), order: 1 },
    { predicate: uri(TITLE), object: lit("Beta"), order: 0 },
    { predicate: uri(TITLE), object: lit("Gamma") },
  ];

  it("writes values in their stored order, unordered ones last", () => {
    const ttl = serializeToTurtle("http://example.org/w1", bindings);
    expect(ttl.indexOf('"Beta"')).toBeLessThan(ttl.indexOf('"Alpha"'));
    expect(ttl.indexOf('"Alpha"')).toBeLessThan(ttl.indexOf('"Gamma"'));
  });

  it("leaves annotations out unless asked for", () => {
    const ttl = serializeToTurtle("http://example.org/w1", bindings);
    expect(ttl).not.toContain("{|");
    expect(ttl).not.toContain("valueOrder");
  });

  it("writes annotations in the syntax Turtle-star and Turtle 1.2 share", () => {
    const ttl = serializeToTurtle("http://example.org/w1", bindings, { valueOrder: true });
    expect(ttl).toContain('"Beta" {| entedit:valueOrder 0 |} ,');
    expect(ttl).toContain('"Alpha" {| entedit:valueOrder 1 |} ,');
    expect(ttl).toContain('"Gamma" .');
    expect(ttl).toContain("@prefix entedit: <http://oslomet.no/abi/vocab#> .");
    expect(ttl.startsWith("# Value order is written as RDF-star annotations")).toBe(true);
  });

  it("adds no header when nothing is annotated", () => {
    const ttl = serializeToTurtle(
      "http://example.org/w1",
      [{ predicate: uri(TITLE), object: lit("Alpha") }],
      { valueOrder: true },
    );
    expect(ttl.startsWith("@prefix")).toBe(true);
    expect(ttl).not.toContain("entedit:");
  });
});
