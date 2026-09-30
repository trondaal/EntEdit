import { describe, expect, it } from "vitest";
import {
  LINK_SELECTION,
  parseSelectionKey,
  selectionKey,
  combineQuery,
  hasFilters,
  normalizeFilters,
  parseFacets,
  toFilterClauses,
  toggleFilter,
} from "./searchFilters";

const GER = "http://id.loc.gov/vocabulary/iso639-2/ger";
const FRE = "http://id.loc.gov/vocabulary/iso639-2/fre";
const NOVEL = "https://id.nb.no/vocabulary/ntsf/81";

describe("toFilterClauses", () => {
  it("is empty without filters", () => {
    expect(toFilterClauses({})).toBe("");
    expect(toFilterClauses({ language: [] })).toBe("");
  });

  it("makes values within a field alternatives and fields required", () => {
    expect(toFilterClauses({ language: [GER, FRE], genre: [NOVEL] })).toBe(
      `+(language:"${GER}" language:"${FRE}") +(genre:"${NOVEL}")`,
    );
  });

  it("leaves out the excepted field", () => {
    expect(toFilterClauses({ language: [GER], genre: [NOVEL] }, "language")).toBe(
      `+(genre:"${NOVEL}")`,
    );
  });

  it("refuses IRIs that could break out of the query", () => {
    expect(() => toFilterClauses({ language: ['http://x/"a'] })).toThrow();
  });
});

describe("combineQuery", () => {
  it("joins text and filters, or matches everything", () => {
    expect(combineQuery("+mars", "+(genre:\"x\")")).toBe('+mars +(genre:"x")');
    expect(combineQuery("", "+(genre:\"x\")")).toBe('+(genre:"x")');
    expect(combineQuery("", "")).toBe("*:*");
  });
});

describe("filter state", () => {
  it("toggles values", () => {
    const once = toggleFilter({}, "language", GER);
    expect(once).toEqual({ language: [GER] });
    expect(toggleFilter(once, "language", GER)).toEqual({ language: [] });
  });

  it("normalizes for cache keys", () => {
    expect(normalizeFilters({ genre: [], language: [GER, FRE, GER] })).toEqual({
      language: [FRE, GER],
    });
    expect(hasFilters({ genre: [] })).toBe(false);
    expect(hasFilters({ genre: [NOVEL] })).toBe(true);
  });
});

describe("parseFacets", () => {
  const row = (name: string, value: string, count: number) => ({
    name: { type: "literal" as const, value: name },
    value: { type: "literal" as const, value },
    count: { type: "literal" as const, value: String(count) },
  });

  it("groups by field, sorts by count and ignores other fields", () => {
    expect(
      parseFacets([row("language", FRE, 3), row("language", GER, 9), row("titles", "x", 1)]),
    ).toEqual({ language: [{ value: GER, count: 9 }, { value: FRE, count: 3 }] });
  });

  it("keeps the manifestation-level fields", () => {
    expect(parseFacets([row("mediaType", "m", 2), row("carrierType", "c", 1)])).toEqual({
      mediaType: [{ value: "m", count: 2 }],
      carrierType: [{ value: "c", count: 1 }],
    });
  });
});

describe("selection keys", () => {
  it("round-trip a field and value, IRIs included", () => {
    const key = selectionKey("language", "http://id.loc.gov/vocabulary/iso639-2/ger");
    expect(parseSelectionKey(key)).toEqual({ field: "language", value: "http://id.loc.gov/vocabulary/iso639-2/ger" });
  });

  it("do not mistake the link for a filter", () => {
    expect(parseSelectionKey(LINK_SELECTION)).toBeNull();
  });
});
