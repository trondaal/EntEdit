import { describe, expect, it } from "vitest";
import { languageName, languagesInUse, VALUE_LANGUAGES } from "./languages";

describe("VALUE_LANGUAGES", () => {
  it("covers the interface languages and the Nordic ones", () => {
    for (const code of ["en", "no", "nb", "nn", "da", "sv"]) {
      expect(VALUE_LANGUAGES).toContain(code);
    }
  });
});

describe("languageName", () => {
  it("names a language in the interface language, with its code", () => {
    expect(languageName("nn", "en")).toMatch(/Nynorsk.*\(nn\)/i);
    expect(languageName("de", "en")).toMatch(/German.*\(de\)/i);
  });

  it("falls back to the bare code for a malformed tag", () => {
    // Intl.DisplayNames throws on these; a well-formed but unknown tag gets a
    // synthesised name instead, which is fine to show.
    expect(languageName("!!", "en")).toBe("!!");
  });
});

describe("languagesInUse", () => {
  it("treats an untagged value as its own language", () => {
    expect(languagesInUse([{ value: "A" }, { value: "B", lang: "no" }]).size).toBe(2);
  });

  it("ignores empty values", () => {
    const langs = languagesInUse([{ value: "A" }, { value: "  ", lang: "no" }]);
    expect(langs).toEqual(new Set([""]));
  });

  it("reports one language when all values agree", () => {
    expect(
      languagesInUse([{ value: "A", lang: "en" }, { value: "B", lang: "en" }]).size,
    ).toBe(1);
  });
});
