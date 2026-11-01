import { describe, expect, it } from "vitest";
import {
  buildRelationshipListQuery,
  buildRelationshipUsageQuery,
  COMMON_RELATIONSHIPS,
  filterRelationships,
  groupRelationships,
  parseRelationshipList,
  parseRelationshipUsage,
} from "./relationshipList";

const R = "http://rdaregistry.info/Elements/";
const HAS_PART = `${R}e/object/P20145`;
const TRANSLATED_AS = `${R}e/object/P20171`;
const OTHER = `${R}e/object/P20999`;

describe("buildRelationshipListQuery", () => {
  const query = buildRelationshipListQuery(`${R}c/C10006`, "no");

  it("asks for the active properties from the class to itself, explicit statements only", () => {
    expect(query).toContain(`rdfs:domain <${R}c/C10006>`);
    expect(query).toContain(`rdfs:range <${R}c/C10006>`);
    expect(query).toContain('entedit:status "object property"');
    expect(query).toContain("FROM <http://www.ontotext.com/explicit>");
  });

  it("leaves out what the search lines never show", () => {
    expect(query).toContain("FILTER NOT EXISTS { ?property entedit:display false }");
    expect(query).toContain("1008"); // deprecated in the RDA registry
  });

  it("takes the label in the chosen language, else English", () => {
    expect(query).toContain('"no"');
    expect(query).toContain('"en"');
  });
});

describe("parseRelationshipList", () => {
  it("returns each property once, with its label", () => {
    const entries = parseRelationshipList([
      { property: { value: HAS_PART }, label: { value: "has part expression" } },
      { property: { value: HAS_PART }, label: { value: "has part expression" } },
      { property: { value: TRANSLATED_AS }, label: { value: "is translated as" } },
      { property: { value: OTHER } },
    ]);
    expect(entries).toEqual([
      { uri: HAS_PART, label: "has part expression" },
      { uri: TRANSLATED_AS, label: "is translated as" },
    ]);
  });
});

describe("the usage query", () => {
  it("counts per property, in either direction, from explicit statements", () => {
    const query = buildRelationshipUsageQuery([HAS_PART, TRANSLATED_AS]);
    expect(query).toContain(`VALUES ?shown { <${HAS_PART}> <${TRANSLATED_AS}> }`);
    expect(query).toContain("?shown owl:inverseOf ?stated");
    expect(query).toContain("COUNT(DISTINCT ?entity)");
    expect(query).toContain("FROM <http://www.ontotext.com/explicit>");
  });

  it("reads a relationship nobody uses as zero", () => {
    const usage = parseRelationshipUsage(
      [{ shown: { value: HAS_PART }, n: { value: "1234" } }],
      [HAS_PART, TRANSLATED_AS],
    );
    expect(usage.get(HAS_PART)).toBe(1234);
    expect(usage.get(TRANSLATED_AS)).toBe(0);
  });
});

describe("groupRelationships", () => {
  const entries = [
    { uri: OTHER, label: "a rarely used one" },
    { uri: TRANSLATED_AS, label: "is translated as" },
    { uri: HAS_PART, label: "has part expression" },
  ];

  it("puts the common relationships first, in the set's order, and the rest after in label order", () => {
    const { common, others } = groupRelationships(entries, "expression");
    expect(common.map((e) => e.uri)).toEqual([HAS_PART, TRANSLATED_AS]);
    expect(others.map((e) => e.uri)).toEqual([OTHER]);
  });

  it("lists only common relationships the profile has", () => {
    expect(groupRelationships([], "work")).toEqual({ common: [], others: [] });
    expect(COMMON_RELATIONSHIPS.expression).toContain(HAS_PART);
  });
});

describe("filterRelationships", () => {
  const entries = [
    { uri: HAS_PART, label: "has part expression" },
    { uri: TRANSLATED_AS, label: "Is translated as" },
  ];

  it("matches part of a label, ignoring case", () => {
    expect(filterRelationships(entries, "TRANSL").map((e) => e.uri)).toEqual([TRANSLATED_AS]);
  });

  it("returns everything for an empty filter", () => {
    expect(filterRelationships(entries, "  ")).toHaveLength(2);
  });
});
