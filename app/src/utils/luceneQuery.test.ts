import { describe, expect, it } from "vitest";
import { toLuceneQuery } from "./luceneQuery";

describe("toLuceneQuery", () => {
  it("leaves plain words untouched", () => {
    expect(toLuceneQuery("no country for old men")).toBe("no country for old men");
  });

  it("escapes characters that break the Lucene parser", () => {
    expect(toLuceneQuery("old men (")).toBe("old men \\(");
    expect(toLuceneQuery('"no country')).toBe('\\"no country');
    expect(toLuceneQuery("title:")).toBe("title\\:");
    expect(toLuceneQuery("c++")).toBe("c\\+\\+");
  });

  it("turns boolean operators into ordinary words", () => {
    expect(toLuceneQuery("AND")).toBe("and");
    expect(toLuceneQuery("war AND peace")).toBe("war and peace");
  });

  it("keeps a trailing * as a prefix wildcard", () => {
    expect(toLuceneQuery("countr*")).toBe("countr*");
    expect(toLuceneQuery("*men")).toBe("\\*men");
    expect(toLuceneQuery("*")).toBe("\\*");
  });

  it("collapses whitespace", () => {
    expect(toLuceneQuery("  old\t men  ")).toBe("old men");
  });
});
