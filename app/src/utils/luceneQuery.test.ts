import { describe, expect, it } from "vitest";
import { hasFuzzyTerms, toLuceneQuery } from "./luceneQuery";

describe("toLuceneQuery", () => {
  it("requires every word", () => {
    expect(toLuceneQuery("no country for old men")).toBe("+no +country +for +old +men");
  });

  it("escapes characters that break the Lucene parser", () => {
    expect(toLuceneQuery("old men (")).toBe("+old +men +\\(");
    expect(toLuceneQuery('"no country')).toBe('+\\"no +country');
    expect(toLuceneQuery("title:")).toBe("+title\\:");
    expect(toLuceneQuery("c++")).toBe("+c\\+\\+");
  });

  it("turns boolean operators into ordinary words", () => {
    expect(toLuceneQuery("AND")).toBe("+and");
    expect(toLuceneQuery("war AND peace")).toBe("+war +and +peace");
  });

  it("keeps a trailing * as a prefix wildcard", () => {
    expect(toLuceneQuery("countr*")).toBe("+countr*");
    expect(toLuceneQuery("*men")).toBe("+\\*men");
    expect(toLuceneQuery("*")).toBe("+\\*");
  });

  it("collapses whitespace", () => {
    expect(toLuceneQuery("  old\t men  ")).toBe("+old +men");
  });
});

describe("toLuceneQuery with fuzzy", () => {
  const fields = (term: string) => `+(names:${term} titles:${term} labels:${term})`;

  it("allows one edit up to five letters and two from six, in name, title and label fields", () => {
    expect(toLuceneQuery("sands", { fuzzy: true })).toBe(fields("sands~1"));
    expect(toLuceneQuery("vermillion", { fuzzy: true })).toBe(fields("vermillion~2"));
  });

  it("keeps short words and wildcards exact", () => {
    expect(toLuceneQuery("the war", { fuzzy: true })).toBe("+the +war");
    expect(toLuceneQuery("countr*", { fuzzy: true })).toBe("+countr*");
  });

  it("counts letters, not UTF-16 units", () => {
    expect(toLuceneQuery("ære", { fuzzy: true })).toBe("+ære");
  });

  it("escapes fuzzy terms", () => {
    expect(toLuceneQuery("c++--", { fuzzy: true })).toBe(fields("c\\+\\+\\-\\-~1"));
  });
});

describe("hasFuzzyTerms", () => {
  it("is false when a fuzzy search would be the same search", () => {
    expect(hasFuzzyTerms("the war")).toBe(false);
    expect(hasFuzzyTerms("countr*")).toBe(false);
    expect(hasFuzzyTerms("vermillion")).toBe(true);
  });
});
