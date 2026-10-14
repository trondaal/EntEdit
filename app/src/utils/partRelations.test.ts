import { describe, expect, it } from "vitest";
import { isHiddenPartLine, isPartProperty, toPartLevels } from "./partRelations";

const R = "http://rdaregistry.info/Elements/";
const WORK_IS_PART = `${R}w/object/P10019`;
const WORK_HAS_PART = `${R}w/object/P10147`;
const EXPR_IS_PART = `${R}e/object/P20074`;
const EXPR_HAS_PART = `${R}e/object/P20145`;
const ADAPTATION = `${R}w/object/P10025`;

describe("isPartProperty", () => {
  it("knows the part pair at both levels, in both directions", () => {
    for (const uri of [WORK_IS_PART, WORK_HAS_PART, EXPR_IS_PART, EXPR_HAS_PART]) {
      expect(isPartProperty(uri)).toBe(true);
    }
  });

  it("leaves every other relationship alone", () => {
    expect(isPartProperty(ADAPTATION)).toBe(false);
    expect(isPartProperty(undefined)).toBe(false);
  });
});

describe("isHiddenPartLine", () => {
  it("hides nothing by default: both levels show", () => {
    expect(isHiddenPartLine(WORK_IS_PART, "work", "both")).toBe(false);
    expect(isHiddenPartLine(EXPR_IS_PART, "expression", "both")).toBe(false);
  });

  it("with 'work', hides the expression-level part lines only", () => {
    expect(isHiddenPartLine(EXPR_IS_PART, "expression", "work")).toBe(true);
    expect(isHiddenPartLine(EXPR_HAS_PART, "expression", "work")).toBe(true);
    expect(isHiddenPartLine(WORK_IS_PART, "work", "work")).toBe(false);
    expect(isHiddenPartLine(WORK_HAS_PART, "work", "work")).toBe(false);
  });

  it("with 'expression', hides the work-level part lines only", () => {
    expect(isHiddenPartLine(WORK_IS_PART, "work", "expression")).toBe(true);
    expect(isHiddenPartLine(WORK_HAS_PART, "work", "expression")).toBe(true);
    expect(isHiddenPartLine(EXPR_IS_PART, "expression", "expression")).toBe(false);
  });

  it("never hides a relationship that is not a part relationship, or one of unknown property", () => {
    for (const partLevels of ["work", "expression"] as const) {
      expect(isHiddenPartLine(ADAPTATION, "work", partLevels)).toBe(false);
      expect(isHiddenPartLine(ADAPTATION, "expression", partLevels)).toBe(false);
      expect(isHiddenPartLine(undefined, "work", partLevels)).toBe(false);
    }
  });
});

describe("toPartLevels", () => {
  it("keeps a valid value and falls back to both for anything else", () => {
    expect(toPartLevels("work")).toBe("work");
    expect(toPartLevels("expression")).toBe("expression");
    expect(toPartLevels("both")).toBe("both");
    expect(toPartLevels(undefined)).toBe("both");
    expect(toPartLevels("everything")).toBe("both");
  });
});
