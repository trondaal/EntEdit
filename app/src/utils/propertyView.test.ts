import { describe, expect, it } from "vitest";
import {
  INITIAL_VISIBLE,
  SHOW_MORE_STEP,
  showMoreTarget,
  toggled,
  visibleCount,
  visibleItems,
} from "./propertyView";

const reading = { isEditing: false, collapsed: false };

describe("visibleCount", () => {
  it("shows a short list in full", () => {
    expect(visibleCount(3, undefined, reading)).toBe(3);
    expect(visibleCount(INITIAL_VISIBLE, undefined, reading)).toBe(INITIAL_VISIBLE);
  });

  it("does not hide a tail of one or two values behind a button", () => {
    expect(visibleCount(INITIAL_VISIBLE + 2, undefined, reading)).toBe(INITIAL_VISIBLE + 2);
    expect(visibleCount(INITIAL_VISIBLE + 3, undefined, reading)).toBe(INITIAL_VISIBLE);
  });

  it("cuts a long list to the first few", () => {
    expect(visibleCount(143, undefined, reading)).toBe(INITIAL_VISIBLE);
  });

  it("shows as many as were asked for, and all when that reaches the end", () => {
    expect(visibleCount(143, 55, reading)).toBe(55);
    expect(visibleCount(143, 141, reading)).toBe(143);
    expect(visibleCount(143, 500, reading)).toBe(143);
  });

  it("never shows fewer than the initial few", () => {
    expect(visibleCount(143, 1, reading)).toBe(INITIAL_VISIBLE);
  });

  it("shows nothing when collapsed", () => {
    expect(visibleCount(143, 55, { isEditing: false, collapsed: true })).toBe(0);
  });

  it("shows everything while editing, collapsed or not", () => {
    expect(visibleCount(143, undefined, { isEditing: true, collapsed: false })).toBe(143);
    expect(visibleCount(143, undefined, { isEditing: true, collapsed: true })).toBe(143);
  });
});

describe("visibleItems", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it("is a prefix of the list, so indexes stay valid", () => {
    expect(visibleItems(items, undefined, reading)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is empty when collapsed", () => {
    expect(visibleItems(items, undefined, { isEditing: false, collapsed: true })).toEqual([]);
  });
});

describe("showMoreTarget", () => {
  it("adds one step to what is shown", () => {
    expect(showMoreTarget(INITIAL_VISIBLE)).toBe(INITIAL_VISIBLE + SHOW_MORE_STEP);
  });
});

describe("toggled", () => {
  it("adds a missing uri and removes a present one, leaving the original alone", () => {
    const empty: ReadonlySet<string> = new Set();
    const one = toggled(empty, "p");
    expect([...one]).toEqual(["p"]);
    expect([...empty]).toEqual([]);
    expect([...toggled(one, "p")]).toEqual([]);
  });
});
