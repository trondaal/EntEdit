import { describe, expect, it } from "vitest";
import { sameConnection } from "./connectionTest";

describe("sameConnection", () => {
  const saved = { url: "http://localhost/graphdb/repositories/EntEdit", username: "", password: "" };

  it("treats a missing login like an empty one", () => {
    expect(sameConnection(saved, { url: saved.url })).toBe(true);
  });

  it("ignores whitespace around the URL", () => {
    expect(sameConnection(saved, { ...saved, url: ` ${saved.url} ` })).toBe(true);
  });

  it("notices a changed URL, user or password", () => {
    expect(sameConnection(saved, { ...saved, url: "http://other/repositories/x" })).toBe(false);
    expect(sameConnection(saved, { ...saved, username: "ann" })).toBe(false);
    expect(sameConnection(saved, { ...saved, password: "secret" })).toBe(false);
  });
});
