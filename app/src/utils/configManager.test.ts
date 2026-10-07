import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA_GRAPH } from "./dataGraph";
import { loadConfiguration, saveConfiguration } from "./configManager";

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
