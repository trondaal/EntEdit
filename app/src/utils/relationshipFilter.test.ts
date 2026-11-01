import { describe, expect, it } from "vitest";
import {
  hiddenFromPartLevels,
  isHiddenRelationship,
  sameHidden,
  toHiddenRelationships,
  withHidden,
} from "./relationshipFilter";

const R = "http://rdaregistry.info/Elements/";
const WORK_IS_PART = `${R}w/object/P10019`;
const WORK_HAS_PART = `${R}w/object/P10147`;
const EXPR_IS_PART = `${R}e/object/P20074`;
const EXPR_HAS_PART = `${R}e/object/P20145`;
const ADAPTATION = `${R}w/object/P10025`;

describe("isHiddenRelationship", () => {
  it("hides exactly the properties in the list", () => {
    const hidden = new Set([EXPR_HAS_PART]);
    expect(isHiddenRelationship(EXPR_HAS_PART, hidden)).toBe(true);
    expect(isHiddenRelationship(EXPR_IS_PART, hidden)).toBe(false);
    expect(isHiddenRelationship(WORK_HAS_PART, hidden)).toBe(false);
  });

  it("hides nothing by default, and never a line of unknown property", () => {
    expect(isHiddenRelationship(ADAPTATION, new Set())).toBe(false);
    expect(isHiddenRelationship(undefined, new Set([ADAPTATION]))).toBe(false);
  });
});

describe("toHiddenRelationships", () => {
  it("keeps URIs, sorted and without repeats", () => {
    expect(toHiddenRelationships([EXPR_IS_PART, WORK_IS_PART, EXPR_IS_PART])).toEqual([
      EXPR_IS_PART,
      WORK_IS_PART,
    ]);
  });

  it("drops anything that is not a URI, and treats a non-list as empty", () => {
    expect(toHiddenRelationships(["", "has part", 3, null, ADAPTATION])).toEqual([ADAPTATION]);
    expect(toHiddenRelationships(undefined)).toEqual([]);
    expect(toHiddenRelationships("work")).toEqual([]);
  });
});

describe("hiddenFromPartLevels (the earlier part-level preference)", () => {
  it("'work' left out the expression-level part lines", () => {
    expect(hiddenFromPartLevels("work")).toEqual([EXPR_IS_PART, EXPR_HAS_PART].sort());
  });

  it("'expression' left out the work-level part lines", () => {
    expect(hiddenFromPartLevels("expression")).toEqual([WORK_IS_PART, WORK_HAS_PART].sort());
  });

  it("'both' and anything else hid nothing", () => {
    expect(hiddenFromPartLevels("both")).toEqual([]);
    expect(hiddenFromPartLevels(undefined)).toEqual([]);
    expect(hiddenFromPartLevels("everything")).toEqual([]);
  });
});

describe("withHidden", () => {
  it("hides and shows without touching the rest, and without repeats", () => {
    const one = withHidden([], [EXPR_HAS_PART, WORK_HAS_PART], true);
    expect(one).toEqual([EXPR_HAS_PART, WORK_HAS_PART].sort());
    expect(withHidden(one, [EXPR_HAS_PART], true)).toEqual(one);
    expect(withHidden(one, [EXPR_HAS_PART], false)).toEqual([WORK_HAS_PART]);
  });

  it("does not change the list it was given", () => {
    const before = [ADAPTATION];
    withHidden(before, [EXPR_HAS_PART], true);
    expect(before).toEqual([ADAPTATION]);
  });
});

describe("sameHidden", () => {
  it("compares as sets", () => {
    expect(sameHidden([ADAPTATION, EXPR_IS_PART], [EXPR_IS_PART, ADAPTATION])).toBe(true);
    expect(sameHidden([ADAPTATION], [])).toBe(false);
  });
});
