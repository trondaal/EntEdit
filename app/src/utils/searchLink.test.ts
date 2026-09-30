import { describe, expect, it } from "vitest";
import { toLinkQuery, toNameQuery } from "./searchLink";
import { toLuceneQuery } from "./luceneQuery";

const WORK = "http://www.wikidata.org/entity/Q6692707";

describe("toNameQuery", () => {
  it("searches the name as a phrase in the names field", () => {
    expect(toNameQuery("Ballard, J. G.")).toBe('+names:"Ballard, J. G."');
  });

  it("escapes quotes and backslashes inside the phrase", () => {
    expect(toNameQuery(' Say "hi" \\ ')).toBe('+names:"Say \\"hi\\" \\\\"');
  });
});

describe("toLinkQuery", () => {
  it("limits a work link to the work and lets the label's words only rank", () => {
    const query = toLinkQuery({ label: "Katz und Maus / Günter Grass", uri: WORK, kind: "work" })!;
    expect(query.startsWith(`+work:"${WORK}" Katz und Maus Günter Grass `)).toBe(true);
    // Only the limit is required: translations with other titles are found too
    expect(query.match(/(^| )\+/g)).toHaveLength(1);
  });

  it("limits an expression link to the expression", () => {
    expect(toLinkQuery({ label: "Cat and Mouse", uri: "http://x/e1", kind: "expression" })).toMatch(
      /^\+expression:"http:\/\/x\/e1" Cat and Mouse/,
    );
  });

  it("searches an agent's name as a phrase", () => {
    expect(toLinkQuery({ label: "Grass, Günter", uri: "http://x/p1", kind: "agent" })).toBe(
      '+names:"Grass, Günter"',
    );
  });

  it("falls back to the label as typed without an IRI", () => {
    expect(toLinkQuery({ label: "Cat and Mouse", kind: "work" })).toBeUndefined();
  });

  it("refuses IRIs that could break out of the query", () => {
    expect(() => toLinkQuery({ label: "x", uri: 'http://x/"a', kind: "work" })).toThrow();
  });
});

describe("toLuceneQuery with optional words", () => {
  it("drops the + but keeps escaping and the phrase", () => {
    expect(toLuceneQuery("Low-flying aircraft", { optional: true })).toBe(
      'Low\\-flying aircraft (names:"Low-flying aircraft" titles:"Low-flying aircraft" labels:"Low-flying aircraft")^10',
    );
  });
});
