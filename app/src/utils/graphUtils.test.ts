import { describe, it, expect } from "vitest";
import { getGraphVisualizationUrl, getWorkbenchRepositoryId } from "./graphUtils";

const ENTITY = "http://viaf.org/viaf/29558386";
const ENCODED = encodeURIComponent(ENTITY);

describe("getGraphVisualizationUrl", () => {
  it("uses the host directly when GraphDB serves the endpoint itself", () => {
    expect(
      getGraphVisualizationUrl("http://localhost:7200/repositories/EntEdit", ENTITY),
    ).toBe(`http://localhost:7200/graphs-visualizations?uri=${ENCODED}`);
  });

  it("keeps the proxy path when the endpoint is proxied under /graphdb", () => {
    expect(
      getGraphVisualizationUrl("http://localhost/graphdb/repositories/EntEdit", ENTITY),
    ).toBe(`http://localhost/graphdb/graphs-visualizations?uri=${ENCODED}`);
  });

  it("keeps a multi-segment proxy path", () => {
    expect(
      getGraphVisualizationUrl("https://example.org/rdf/graphdb/repositories/X", ENTITY),
    ).toBe(`https://example.org/rdf/graphdb/graphs-visualizations?uri=${ENCODED}`);
  });

  it("keeps a non-default port on a proxied host", () => {
    expect(
      getGraphVisualizationUrl(
        "http://dijon.idi.ntnu.no:8080/repositories/VBINF6000-H26-G01",
        ENTITY,
      ),
    ).toBe(
      `http://dijon.idi.ntnu.no:8080/graphs-visualizations?uri=${ENCODED}`,
    );
  });

  it("tolerates a trailing slash on the endpoint", () => {
    expect(
      getGraphVisualizationUrl("http://localhost/graphdb/repositories/EntEdit/", ENTITY),
    ).toContain("http://localhost/graphdb/graphs-visualizations?uri=");
  });

  it("handles an endpoint that is already the GraphDB root", () => {
    expect(getGraphVisualizationUrl("http://localhost:7200/", ENTITY)).toBe(
      `http://localhost:7200/graphs-visualizations?uri=${ENCODED}`,
    );
  });

  it("returns null for an unparseable endpoint", () => {
    expect(getGraphVisualizationUrl("not a url", ENTITY)).toBeNull();
  });
});

describe("getWorkbenchRepositoryId", () => {
  it("extracts the repository id from a direct endpoint", () => {
    expect(getWorkbenchRepositoryId("http://localhost:7200/repositories/EntEdit")).toBe(
      "EntEdit",
    );
  });

  it("extracts it from a proxied endpoint", () => {
    expect(
      getWorkbenchRepositoryId("http://entedit.org/graphdb/repositories/VBINF6000-H26-G01"),
    ).toBe("VBINF6000-H26-G01");
  });

  it("tolerates a trailing slash", () => {
    expect(getWorkbenchRepositoryId("http://localhost/graphdb/repositories/EntEdit/")).toBe(
      "EntEdit",
    );
  });

  it("decodes percent-escapes in the id", () => {
    expect(getWorkbenchRepositoryId("http://localhost:7200/repositories/my%20repo")).toBe(
      "my repo",
    );
  });

  it("returns null when there is no repository segment", () => {
    expect(getWorkbenchRepositoryId("http://localhost:7200/")).toBeNull();
  });

  it("returns null for an unparseable endpoint", () => {
    expect(getWorkbenchRepositoryId("not a url")).toBeNull();
  });
});
