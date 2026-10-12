import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { CONNECTION_TEST_QUERY, sameConnection, testEndpointConnection } from "./connectionTest";

const query = vi.hoisted(() => vi.fn());
vi.mock("./sparqlClient", () => ({
  SparqlClient: class {
    query = query;
  },
}));

const t = ((key: string) => key) as unknown as TFunction;
const config = { url: "http://localhost/graphdb/repositories/EntEdit" };

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

describe("testEndpointConnection", () => {
  beforeEach(() => query.mockReset());

  it("asks for one statement instead of counting them all", () => {
    expect(CONNECTION_TEST_QUERY).toMatch(/LIMIT 1/);
    expect(CONNECTION_TEST_QUERY).not.toMatch(/COUNT/i);
  });

  it("reports a repository with statements as holding data", async () => {
    query.mockResolvedValue({ head: { vars: ["s"] }, results: { bindings: [{ s: { type: "uri", value: "urn:x" } }] } });
    const result = await testEndpointConnection(config, t);
    expect(query).toHaveBeenCalledWith(CONNECTION_TEST_QUERY);
    expect(result).toMatchObject({ success: true, hasData: true });
  });

  it("reports an empty repository as empty (a COUNT query always returned a row)", async () => {
    query.mockResolvedValue({ head: { vars: ["s"] }, results: { bindings: [] } });
    expect(await testEndpointConnection(config, t)).toMatchObject({ success: true, hasData: false });
  });

  it("needs a URL", async () => {
    expect(await testEndpointConnection({ url: "  " }, t)).toMatchObject({ success: false });
    expect(query).not.toHaveBeenCalled();
  });
});
