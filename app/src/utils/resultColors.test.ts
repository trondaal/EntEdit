import { describe, expect, it } from "vitest";
import {
  LEVEL_BACKGROUNDS,
  cardBackground,
  cardBorder,
  levelBackground,
  sectionStyle,
  toResultColors,
} from "./resultColors";

describe("toResultColors", () => {
  it("keeps the default unless the address asks for levels", () => {
    expect(toResultColors("level")).toBe("level");
    expect(toResultColors(null)).toBe("type");
    expect(toResultColors("")).toBe("type");
    expect(toResultColors("anything else")).toBe("type");
  });
});

describe("levelBackground", () => {
  it("starts white and darkens with every level", () => {
    const lightness = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(levelBackground(0)).toBe("#ffffff");
    for (let level = 1; level < LEVEL_BACKGROUNDS.length; level++) {
      expect(lightness(levelBackground(level))).toBeLessThan(lightness(levelBackground(level - 1)));
    }
  });

  it("stays on the darkest shade below the last level, and on white above the first", () => {
    expect(levelBackground(99)).toBe(LEVEL_BACKGROUNDS[LEVEL_BACKGROUNDS.length - 1]);
    expect(levelBackground(-1)).toBe("#ffffff");
  });
});

describe("cardBorder", () => {
  it("keeps the border everywhere in the default mode", () => {
    expect(cardBorder("type", 0)).toBe(1);
    expect(cardBorder("type", 2)).toBe(1);
  });

  it("drops it for cards inside a list in level mode, but not for a result at the top", () => {
    expect(cardBorder("level", 0)).toBe(1);
    expect(cardBorder("level", 1)).toBe(0);
    expect(cardBorder("level", 3)).toBe(0);
  });
});

describe("cardBackground and sectionStyle", () => {
  it("keep today's look in the default mode, whatever the level", () => {
    expect(cardBackground("type", 0)).toBe("background.paper");
    expect(cardBackground("type", 3)).toBe("background.paper");
    expect(sectionStyle("type", 1).bgcolor).toBe(sectionStyle("type", 3).bgcolor);
  });

  it("give a card and the list it is in the same shade in level mode", () => {
    expect(cardBackground("level", 2)).toBe(sectionStyle("level", 2).bgcolor);
    expect(sectionStyle("level", 1).bgcolor).not.toBe(sectionStyle("level", 2).bgcolor);
  });
});
