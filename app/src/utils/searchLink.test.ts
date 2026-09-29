import { describe, expect, it } from "vitest";
import { toNameQuery } from "./searchLink";

describe("toNameQuery", () => {
  it("searches the name as a phrase in the names field", () => {
    expect(toNameQuery("Ballard, J. G.")).toBe('+names:"Ballard, J. G."');
  });

  it("escapes quotes and backslashes inside the phrase", () => {
    expect(toNameQuery(' Say "hi" \\ ')).toBe('+names:"Say \\"hi\\" \\\\"');
  });
});
