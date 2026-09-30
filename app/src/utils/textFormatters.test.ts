import { describe, expect, it } from "vitest";
import { formatTitleArea } from "./textFormatters";

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
