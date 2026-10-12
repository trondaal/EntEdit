import { afterEach, describe, it, expect, vi } from "vitest";
import {
  getGraphVisualizationUrl,
  getWorkbenchRepositoryId,
  getWorkbenchUrl,
  prepareWorkbenchRepository,
} from "./graphUtils";

const ENTITY = "http://viaf.org/viaf/29558386";
const ENCODED = encodeURIComponent(ENTITY);

describe("getGraphVisualizationUrl", () => {
  it("uses the host directly when GraphDB serves the endpoint itself", () => {
    expect(
      getGraphVisualizationUrl("http://localhost:7200/repositories/EntEdit", ENTITY),
    ).toBe(`http://localhost:7200/graphs-visualizations?uri=${ENCODED}&repositoryId=EntEdit`);
  });

  it("keeps the proxy path when the endpoint is proxied under /graphdb", () => {
    expect(
      getGraphVisualizationUrl("http://localhost/graphdb/repositories/EntEdit", ENTITY),
    ).toBe(`http://localhost/graphdb/graphs-visualizations?uri=${ENCODED}&repositoryId=EntEdit`);
  });

  it("keeps a multi-segment proxy path", () => {
    expect(
      getGraphVisualizationUrl("https://example.org/rdf/graphdb/repositories/X", ENTITY),
    ).toBe(`https://example.org/rdf/graphdb/graphs-visualizations?uri=${ENCODED}&repositoryId=X`);
  });

  it("keeps a non-default port on a proxied host", () => {
    expect(
      getGraphVisualizationUrl(
        "http://dijon.idi.ntnu.no:8080/repositories/VBINF6000-H26-G01",
        ENTITY,
      ),
    ).toBe(
      `http://dijon.idi.ntnu.no:8080/graphs-visualizations?uri=${ENCODED}&repositoryId=VBINF6000-H26-G01`,
    );
  });

  it("tolerates a trailing slash on the endpoint", () => {
    expect(
      getGraphVisualizationUrl("http://localhost/graphdb/repositories/EntEdit/", ENTITY),
    ).toContain("http://localhost/graphdb/graphs-visualizations?uri=");
  });

  it("handles an endpoint that is already the GraphDB root: no repository to name", () => {
    expect(getGraphVisualizationUrl("http://localhost:7200/", ENTITY)).toBe(
      `http://localhost:7200/graphs-visualizations?uri=${ENCODED}`,
    );
  });

  it("names the repository, so a GraphDB 11 Workbench connects to it", () => {
    expect(
      getGraphVisualizationUrl("http://dijon.idi.ntnu.no/graphdb-data/repositories/isfdb", ENTITY),
    ).toBe(
      `http://dijon.idi.ntnu.no/graphdb-data/graphs-visualizations?uri=${ENCODED}&repositoryId=isfdb`,
    );
  });

  it("encodes a repository id that needs it", () => {
    expect(
      getGraphVisualizationUrl("http://localhost:7200/repositories/my%20repo", ENTITY),
    ).toContain("&repositoryId=my%20repo");
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

describe("getWorkbenchUrl", () => {
  it("points at a Workbench page next to the repository endpoint, for that repository", () => {
    expect(getWorkbenchUrl("http://localhost/graphdb/repositories/EntEdit", "graphs")).toBe(
      "http://localhost/graphdb/graphs?repositoryId=EntEdit",
    );
    expect(getWorkbenchUrl("http://localhost:7200/repositories/EntEdit", "graphs")).toBe(
      "http://localhost:7200/graphs?repositoryId=EntEdit",
    );
  });

  it("adds no repository when the endpoint names none", () => {
    expect(getWorkbenchUrl("http://localhost:7200/", "graphs")).toBe("http://localhost:7200/graphs");
  });
});

describe("prepareWorkbenchRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubBrowser = () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { location: { href: "http://dijon.idi.ntnu.no/entedit/", origin: "http://dijon.idi.ntnu.no" } });
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    return store;
  };

  it("seeds both Workbench versions' keys for a same-origin endpoint", () => {
    const store = stubBrowser();
    prepareWorkbenchRepository("http://dijon.idi.ntnu.no/graphdb-data/repositories/isfdb");
    expect(store.get("ls.repository-id")).toBe("isfdb");
    expect(store.get("ls.repository-location")).toBe("");
    expect(JSON.parse(store.get("ontotext.gdb.repository.selectedRepository") ?? "null")).toEqual({
      id: "isfdb",
      location: "",
    });
  });

  it("leaves another origin alone: its storage is not ours", () => {
    const store = stubBrowser();
    prepareWorkbenchRepository("http://dif03.idi.ntnu.no:7200/repositories/isfdb");
    expect(store.size).toBe(0);
  });
});
