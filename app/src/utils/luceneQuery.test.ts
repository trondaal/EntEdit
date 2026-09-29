import { describe, expect, it } from "vitest";
import { hasFuzzyTerms, toLuceneQuery } from "./luceneQuery";

/** The required words of a query, without the optional phrase boost. */
const required = (input: string, fuzzy = false) =>
  toLuceneQuery(input, { fuzzy }).replace(/ \(names:".*\)\^\d+$/, "");

describe("toLuceneQuery", () => {
  it("requires every word", () => {
    expect(required("no country for old men")).toBe("+no +country +for +old +men");
  });

  it("escapes characters that break the Lucene parser", () => {
    // A lone "(" has no letter or digit and is left out
    expect(required("old men (")).toBe("+old +men");
    expect(toLuceneQuery("men(")).toBe("+men\\(");
    expect(required('"no country')).toBe('+\\"no +country');
    expect(toLuceneQuery("title:")).toBe("+title\\:");
    expect(toLuceneQuery("c++")).toBe("+c\\+\\+");
  });

  it("turns boolean operators into ordinary words", () => {
    expect(toLuceneQuery("AND")).toBe("+and");
    expect(required("war AND peace")).toBe("+war +and +peace");
  });

  it("keeps a trailing * as a prefix wildcard", () => {
    expect(toLuceneQuery("countr*")).toBe("+countr*");
    expect(toLuceneQuery("*men")).toBe("+\\*men");
    expect(toLuceneQuery("*")).toBe("");
  });

  it("leaves out words without a letter or digit", () => {
    expect(required("Low-flying aircraft / J. G. Ballard. – English")).toBe(
      "+Low\\-flying +aircraft +J. +G. +Ballard. +English",
    );
    expect(toLuceneQuery("– / ...")).toBe("");
    expect(toLuceneQuery("1984")).toBe("+1984");
    expect(toLuceneQuery("Æsop")).toBe("+Æsop");
  });

  it("collapses whitespace", () => {
    expect(required("  old\t men  ")).toBe("+old +men");
  });
});

describe("phrase boost", () => {
  it("ranks an entity labelled with the whole text first, without requiring it", () => {
    expect(toLuceneQuery("The dead astronaut / J. G. Ballard. – English")).toBe(
      "+The +dead +astronaut +J. +G. +Ballard. +English " +
        '(names:"The dead astronaut J. G. Ballard. English" ' +
        'titles:"The dead astronaut J. G. Ballard. English" ' +
        'labels:"The dead astronaut J. G. Ballard. English")^10',
    );
  });

  it("is left out for a single word", () => {
    expect(toLuceneQuery("astronaut")).toBe("+astronaut");
  });

  it("escapes quotes and backslashes inside the phrase", () => {
    expect(toLuceneQuery('say "hi\\" now')).toContain('labels:"say \\"hi\\\\\\" now"');
  });
});

describe("toLuceneQuery with fuzzy", () => {
  const fields = (term: string) => `+(names:${term} titles:${term} labels:${term})`;

  it("allows one edit up to five letters and two from six, in name, title and label fields", () => {
    expect(toLuceneQuery("sands", { fuzzy: true })).toBe(fields("sands~1"));
    expect(toLuceneQuery("vermillion", { fuzzy: true })).toBe(fields("vermillion~2"));
  });

  it("keeps short words and wildcards exact", () => {
    expect(required("the war", true)).toBe("+the +war");
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
