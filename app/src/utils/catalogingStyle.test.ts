import { describe, expect, it } from "vitest";
import {
  applyPreset,
  applyStyleOverride,
  CLASSIC_PREFERENCES,
  presetFor,
  SEMANTIC_PREFERENCES,
  styleOf,
} from "./catalogingStyle";

describe("styleOf", () => {
  it("recognises the two presets", () => {
    expect(styleOf(CLASSIC_PREFERENCES)).toBe("classic");
    expect(styleOf(SEMANTIC_PREFERENCES)).toBe("semantic");
  });

  it("reports any other combination as custom", () => {
    expect(styleOf({ ...CLASSIC_PREFERENCES, showLabels: true })).toBe("custom");
  });
});

describe("applyStyleOverride", () => {
  it("applies a preset named in the URL", () => {
    expect(applyStyleOverride(SEMANTIC_PREFERENCES, "?style=classic")).toEqual(
      CLASSIC_PREFERENCES,
    );
    expect(applyStyleOverride(CLASSIC_PREFERENCES, "?nosearch&style=semantic")).toEqual(
      SEMANTIC_PREFERENCES,
    );
  });

  it("keeps the stored preferences when the parameter is absent or unknown", () => {
    const custom = { ...CLASSIC_PREFERENCES, showLabels: true };
    expect(applyStyleOverride(custom, "")).toBe(custom);
    expect(applyStyleOverride(custom, "?style=whatever")).toBe(custom);
    expect(applyStyleOverride(custom, "?demo")).toBe(custom);
  });
});

describe("the inferred marker", () => {
  it("is off in both presets", () => {
    expect(CLASSIC_PREFERENCES.showInferredMarks).toBe(false);
    expect(SEMANTIC_PREFERENCES.showInferredMarks).toBe(false);
  });

  it("does not make a preset read as custom", () => {
    expect(styleOf({ ...SEMANTIC_PREFERENCES, showInferredMarks: true })).toBe("semantic");
    expect(styleOf({ ...CLASSIC_PREFERENCES, showInferredMarks: true })).toBe("classic");
  });

  it("survives switching style, and a style link", () => {
    const withMarks = { ...CLASSIC_PREFERENCES, showInferredMarks: true };
    expect(applyPreset("semantic", withMarks)).toEqual({
      ...SEMANTIC_PREFERENCES,
      showInferredMarks: true,
    });
    expect(applyStyleOverride(withMarks, "?style=semantic")).toEqual({
      ...SEMANTIC_PREFERENCES,
      showInferredMarks: true,
    });
  });
});

describe("the hidden-relationships preference", () => {
  it("hides nothing in both presets, so nothing is hidden until the user chooses", () => {
    expect(CLASSIC_PREFERENCES.hiddenRelationships).toEqual([]);
    expect(SEMANTIC_PREFERENCES.hiddenRelationships).toEqual([]);
  });

  it("does not make a preset read as custom", () => {
    expect(styleOf({ ...SEMANTIC_PREFERENCES, hiddenRelationships: ["http://x/a"] })).toBe("semantic");
    expect(styleOf({ ...CLASSIC_PREFERENCES, hiddenRelationships: ["http://x/a"] })).toBe("classic");
  });

  it("survives switching style, and a style link", () => {
    const chosen = { ...CLASSIC_PREFERENCES, hiddenRelationships: ["http://x/a"] };
    expect(applyPreset("semantic", chosen).hiddenRelationships).toEqual(["http://x/a"]);
    expect(applyStyleOverride(chosen, "?style=semantic").hiddenRelationships).toEqual(["http://x/a"]);
  });
});

describe("presetFor", () => {
  it("maps a style name to its preferences", () => {
    expect(presetFor("classic")).toEqual(CLASSIC_PREFERENCES);
    expect(presetFor("semantic")).toEqual(SEMANTIC_PREFERENCES);
  });
});
