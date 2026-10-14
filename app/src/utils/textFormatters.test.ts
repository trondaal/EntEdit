import { describe, expect, it } from "vitest";
import { formatTitleArea, parseCollapsedRelationships, parseRelationships, SPARQL_SEP } from "./textFormatters";

const uri = "http://example.org/m1";

describe("formatTitleArea", () => {
  it("puts a volume's numbering between the common title and its other titles", () => {
    expect(
      formatTitleArea({
        uri,
        title: "Samlede verker",
        numbering: "B. 18",
        other: "Den gåtefulle ; Bjørger ; Livsfragmenter",
      }),
    ).toBe("Samlede verker: B. 18 : Den gåtefulle ; Bjørger ; Livsfragmenter");
  });

  it("shows the numbering without other title information", () => {
    expect(formatTitleArea({ uri, title: "Grensetrilogien", numbering: "B. 3" })).toBe("Grensetrilogien: B. 3");
  });

  it("keeps title, other title information and responsibility as before", () => {
    expect(formatTitleArea({ uri, title: "Sult", other: "roman", responsibilityStatement: "Knut Hamsun" })).toBe(
      "Sult : roman / Knut Hamsun",
    );
  });

  it("falls back to the URI without a title", () => {
    expect(formatTitleArea({ uri, numbering: "B. 1" })).toBe(uri);
  });
});

describe("parseCollapsedRelationships", () => {
  const P = "http://rdaregistry.info/Elements/w/object/P10147";
  const entry = (label: string, property: string, count: string) =>
    `${label}${SPARQL_SEP.LABEL}${property}${SPARQL_SEP.URI}${count}`;

  it("reads a relationship with its property and how many targets it has", () => {
    expect(parseCollapsedRelationships(entry("has part", P, "463"))).toEqual([
      { relationshipLabel: "has part", propertyUri: P, count: 463 },
    ]);
  });

  it("reads several relationships", () => {
    const text = [entry("has part", P, "463"), entry("is subject of", "http://example.org/s", "12")].join(
      SPARQL_SEP.GROUP,
    );
    expect(parseCollapsedRelationships(text).map((r) => [r.relationshipLabel, r.count])).toEqual([
      ["has part", 463],
      ["is subject of", 12],
    ]);
  });

  it("is empty for nothing, and skips entries that do not parse", () => {
    expect(parseCollapsedRelationships(undefined)).toEqual([]);
    expect(parseCollapsedRelationships("")).toEqual([]);
    expect(parseCollapsedRelationships("no separator")).toEqual([]);
    expect(parseCollapsedRelationships(entry("has part", P, "0"))).toEqual([]);
  });
});

describe("parseRelationships", () => {
  const P = "http://rdaregistry.info/Elements/w/object/P10019";

  it("reads the property a relationship is shown with, then its targets", () => {
    const text = `is part of work${SPARQL_SEP.LABEL}${P}${SPARQL_SEP.PROPERTY}Big anthology${SPARQL_SEP.URI}http://ex.org/w1${SPARQL_SEP.NAME}Other${SPARQL_SEP.URI}http://ex.org/w2`;
    expect(parseRelationships(text)).toEqual([
      {
        relationshipLabel: "is part of work",
        propertyUri: P,
        titles: [
          { title: "Big anthology", uri: "http://ex.org/w1" },
          { title: "Other", uri: "http://ex.org/w2" },
        ],
      },
    ]);
  });

  it("still reads a group without a property, as an older query returned it", () => {
    const text = `has sequel${SPARQL_SEP.LABEL}Next book${SPARQL_SEP.URI}http://ex.org/w3`;
    expect(parseRelationships(text)).toEqual([
      { relationshipLabel: "has sequel", propertyUri: undefined, titles: [{ title: "Next book", uri: "http://ex.org/w3" }] },
    ]);
  });

  it("reads several relationships", () => {
    const text = [
      `is part of work${SPARQL_SEP.LABEL}${P}${SPARQL_SEP.PROPERTY}A${SPARQL_SEP.URI}u1`,
      `has sequel${SPARQL_SEP.LABEL}http://x/p${SPARQL_SEP.PROPERTY}B${SPARQL_SEP.URI}u2`,
    ].join(SPARQL_SEP.GROUP);
    expect(parseRelationships(text).map((r) => [r.relationshipLabel, r.propertyUri, r.titles[0].title])).toEqual([
      ["is part of work", P, "A"],
      ["has sequel", "http://x/p", "B"],
    ]);
  });
});
