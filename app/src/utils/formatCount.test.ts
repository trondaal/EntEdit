import { describe, expect, it } from "vitest";
import { formatCount, formatCountExact } from "./formatCount";

/** Intl separates thousands with a no-break space in some languages: compare with a plain one. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

describe("formatCount", () => {
  it("writes a number below 100,000 in full, with the thousands separator", () => {
    expect(formatCount(7, "en")).toBe("7");
    expect(formatCount(1490, "en")).toBe("1,490");
    expect(formatCount(99999, "en")).toBe("99,999");
    expect(plain(formatCount(1490, "no"))).toBe("1 490");
  });

  it("is compact from 100,000, with one decimal at most", () => {
    expect(formatCount(100000, "en")).toBe("100K");
    expect(formatCount(1530099, "en")).toBe("1.5M");
    expect(formatCount(26000000, "en")).toBe("26M");
  });

  it("follows the language when compact", () => {
    expect(plain(formatCount(1530099, "no"))).toMatch(/^1,5 mill/);
  });
});

describe("formatCountExact", () => {
  it("always writes the whole number", () => {
    expect(formatCountExact(1530099, "en")).toBe("1,530,099");
    expect(plain(formatCountExact(1530099, "no"))).toBe("1 530 099");
  });
});
