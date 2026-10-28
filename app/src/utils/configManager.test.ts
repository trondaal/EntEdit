import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA_GRAPH } from "./dataGraph";
import { getRepositoryEndpointUrl, loadConfiguration, saveConfiguration } from "./configManager";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
};

const endpoint = "http://localhost/graphdb/repositories/EntEdit";

describe("the graph new data is saved in", () => {
  let local: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    local = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", memoryStorage());
  });

  it("is unset until the user chooses one, and then not stored at all", () => {
    saveConfiguration({ url: endpoint }, "en");
    expect(JSON.parse(local.getItem("entEdit.config")!)).toEqual({ url: endpoint });
    expect(loadConfiguration()?.endpoint.dataGraph).toBeUndefined();
  });

  it("is not stored when it is the default, so a changed default reaches everyone", () => {
    saveConfiguration({ url: endpoint, dataGraph: DEFAULT_DATA_GRAPH }, "en");
    expect(JSON.parse(local.getItem("entEdit.config")!)).toEqual({ url: endpoint });
  });

  it("survives a save and a load", () => {
    saveConfiguration({ url: endpoint, dataGraph: "http://example.org/mine" }, "en");
    expect(loadConfiguration()?.endpoint.dataGraph).toBe("http://example.org/mine");
  });

  it("survives a change of language, which saves the same endpoint again", () => {
    const chosen = { url: endpoint, dataGraph: "http://example.org/mine" };
    saveConfiguration(chosen, "en");
    saveConfiguration(loadConfiguration()!.endpoint, "no");
    expect(loadConfiguration()?.endpoint.dataGraph).toBe("http://example.org/mine");
  });

  it("is ignored when what is stored is not a usable IRI", () => {
    local.setItem("entEdit.config", JSON.stringify({ url: endpoint, dataGraph: "not an iri" }));
    expect(loadConfiguration()?.endpoint.dataGraph).toBeUndefined();
  });
});

describe("the part-relationship preference, as stored", () => {
  let local: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    local = memoryStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", memoryStorage());
    local.setItem("entEdit.config", JSON.stringify({ url: endpoint }));
  });

  it("is both when nothing is stored, as for an installation older than the preference", () => {
    local.setItem("entEdit.preferences", JSON.stringify({ showIdentifier: false }));
    expect(loadConfiguration()?.preferences.partLevels).toBe("both");
  });

  it("is read back as chosen", () => {
    local.setItem("entEdit.preferences", JSON.stringify({ partLevels: "expression" }));
    expect(loadConfiguration()?.preferences.partLevels).toBe("expression");
  });

  it("is both when what is stored is not a level", () => {
    local.setItem("entEdit.preferences", JSON.stringify({ partLevels: "everything" }));
    expect(loadConfiguration()?.preferences.partLevels).toBe("both");
  });
});

describe("getRepositoryEndpointUrl", () => {
  it("builds the endpoint of a repository on the given host", () => {
    expect(getRepositoryEndpointUrl("Examples", "https://app.entedit.org")).toBe(
      "https://app.entedit.org/graphdb/repositories/Examples",
    );
    expect(getRepositoryEndpointUrl("VBINF6000-H26-03", "http://localhost:5173")).toBe(
      "http://localhost:5173/graphdb/repositories/VBINF6000-H26-03",
    );
  });

  it("accepts only a plain repository name, never an address or a path", () => {
    for (const name of [
      "",
      "..",
      ".hidden",
      "a.",
      "a/b",
      "../x",
      "http://evil.example/x",
      "//evil.example",
      "a b",
      "a?b",
      "a#b",
      "a%2Fb",
    ]) {
      expect(getRepositoryEndpointUrl(name, "https://app.entedit.org")).toBeNull();
    }
  });
});
