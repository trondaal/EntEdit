import { describe, expect, it } from "vitest";
import {
  buildEntityCountQuery,
  buildEntityPageQuery,
  buildPageLabelsQuery,
  isBuilt,
  isIndexedClass,
  toEntityQuery,
  toLabelQuery,
  withLabels,
} from "./entityList";

const WORK = "http://rdaregistry.info/Elements/c/C10001";

describe("toLabelQuery", () => {
  it("requires every word and leaves the last one open", () => {
    expect(toLabelQuery("Dragon ta")).toBe("+label:dragon +label:ta*");
  });

  it("is empty for an empty filter or punctuation only", () => {
    expect(toLabelQuery("   ")).toBe("");
    expect(toLabelQuery("/ –")).toBe("");
  });

  it("escapes Lucene syntax and keeps accented letters", () => {
    expect(toLabelQuery('Ørret (saga"')).toBe("+label:ørret +label:\\(saga\\\"*");
  });

  it("does not double a typed wildcard", () => {
    expect(toLabelQuery("dra*")).toBe("+label:dra*");
  });
});

describe("toEntityQuery", () => {
  it("limits to the class, then to the label words", () => {
    expect(toEntityQuery(WORK, "")).toBe(`+rdfType:"${WORK}"`);
    expect(toEntityQuery(WORK, "ze")).toBe(`+rdfType:"${WORK}" +label:ze*`);
  });
});

describe("index queries", () => {
  it("pages in the order of the sort field", () => {
    const query = buildEntityPageQuery(WORK, "ze", 50, 100);
    expect(query).toContain('lucene:orderBy "sortLabel"');
    expect(query).toContain('lucene:limit "50"');
    expect(query).toContain('lucene:offset "100"');
    expect(query).toContain('lucene:query "+rdfType:\\"' + WORK + '\\" +label:ze*"');
  });

  it("counts through totalHits", () => {
    expect(buildEntityCountQuery(WORK, "")).toContain("lucene:totalHits ?total");
  });

  it("refuses an unsafe class IRI", () => {
    expect(() => buildEntityPageQuery("http://x> } DROP", "", 50, 0)).toThrow();
  });
});

describe("buildPageLabelsQuery", () => {
  it("looks up the page's entities and ends with any label", () => {
    const query = buildPageLabelsQuery(["http://ex.org/a", "http://ex.org/b"], "en");
    expect(query).toContain("VALUES ?entity { <http://ex.org/a> <http://ex.org/b> }");
    expect(query).toContain("COALESCE(?label_chosen, ?label_none, ?label_fallback, ?label_any)");
    expect(query).toContain("GROUP BY ?entity");
  });
});

describe("withLabels", () => {
  it("keeps the index order and falls back to the IRI", () => {
    const labels = new Map([["http://ex.org/b", "B"]]);
    expect(withLabels(["http://ex.org/b", "http://ex.org/a"], labels)).toEqual([
      { uri: "http://ex.org/b", label: "B" },
      { uri: "http://ex.org/a", label: "http://ex.org/a" },
    ]);
  });
});

describe("isIndexedClass / isBuilt", () => {
  it("knows the indexed classes", () => {
    expect(isIndexedClass(WORK)).toBe(true);
    expect(isIndexedClass("http://example.org/Custom")).toBe(false);
  });

  it("reads the connector status", () => {
    expect(isBuilt('{"status":"BUILT"}')).toBe(true);
    expect(isBuilt('{"status":"BUILDING"}')).toBe(false);
    expect(isBuilt("nonsense")).toBe(false);
    expect(isBuilt(undefined)).toBe(false);
  });
});
