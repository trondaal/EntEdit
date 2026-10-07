import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATA_GRAPH,
  dataGraphOf,
  graphForSave,
  isGraphSettingInvalid,
  isUsableGraphIri,
} from "./dataGraph";

describe("isUsableGraphIri", () => {
  it("accepts absolute IRIs", () => {
    expect(isUsableGraphIri("http://entedit.org/data")).toBe(true);
    expect(isUsableGraphIri("urn:example:mydata")).toBe(true);
    expect(isUsableGraphIri(" https://example.org/g/1 ")).toBe(true);
  });

  it("rejects what cannot be a graph name or would break a query", () => {
    for (const bad of ["", "data", "/data", "http://a b", "http://a>b", 'http://a"b', "http://a\nb", "http:"]) {
      expect(isUsableGraphIri(bad)).toBe(false);
    }
  });
});

describe("isGraphSettingInvalid", () => {
  it("treats an empty setting as fine, since it means the default", () => {
    expect(isGraphSettingInvalid("")).toBe(false);
    expect(isGraphSettingInvalid("   ")).toBe(false);
    expect(isGraphSettingInvalid("not an iri")).toBe(true);
    expect(isGraphSettingInvalid("http://entedit.org/mine")).toBe(false);
  });
});

describe("dataGraphOf", () => {
  it("falls back to the default when nothing usable is set", () => {
    expect(dataGraphOf()).toBe(DEFAULT_DATA_GRAPH);
    expect(dataGraphOf({})).toBe(DEFAULT_DATA_GRAPH);
    expect(dataGraphOf({ dataGraph: "  " })).toBe(DEFAULT_DATA_GRAPH);
    expect(dataGraphOf({ dataGraph: "oops" })).toBe(DEFAULT_DATA_GRAPH);
  });

  it("uses the setting, trimmed", () => {
    expect(dataGraphOf({ dataGraph: " http://example.org/mine " })).toBe("http://example.org/mine");
  });
});

describe("graphForSave", () => {
  const data = "http://entedit.org/data";

  it("writes a new entity to the data graph", () => {
    expect(graphForSave(true, undefined, data)).toBe(data);
  });

  it("keeps an existing entity in the graph it came from", () => {
    expect(graphForSave(false, "http://entedit.org/examples", data)).toBe("http://entedit.org/examples");
  });

  it("leaves an entity from the default graph there rather than moving it", () => {
    expect(graphForSave(false, undefined, data)).toBeUndefined();
  });
});
