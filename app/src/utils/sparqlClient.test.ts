import { describe, it, expect, vi, afterEach } from "vitest";
import { SparqlClient, SparqlError } from "./sparqlClient";

const config = { url: "http://localhost:7200/repositories/EntEdit" };

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Installs a typed fetch spy on globalThis and returns it so call arguments
 * (url, RequestInit) can be asserted with proper types. */
function mockFetch(impl: FetchImpl) {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function errorResponse(status: number, statusText = "Error"): Response {
  return {
    ok: false,
    status,
    statusText,
    text: async () => `server said ${status}`,
    json: async () => ({}),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SparqlClient.query", () => {
  it("POSTs the query and returns parsed JSON", async () => {
    const payload = { head: { vars: [] }, results: { bindings: [] } };
    mockFetch(async () => jsonResponse(payload));
    const client = new SparqlClient(config);
    const result = await client.query("SELECT * WHERE { ?s ?p ?o }");
    expect(result).toEqual(payload);
  });

  it("sends infer=true for query() and infer=false for queryWithoutInference()", async () => {
    const spy = mockFetch(async () => jsonResponse({ results: { bindings: [] } }));
    const client = new SparqlClient(config);

    await client.query("SELECT 1");
    let body = spy.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get("infer")).toBe("true");

    await client.queryWithoutInference("SELECT 1");
    body = spy.mock.calls[1][1]!.body as URLSearchParams;
    expect(body.get("infer")).toBe("false");
  });

  it("adds a Basic auth header only when credentials are present", async () => {
    const spy = mockFetch(async () => jsonResponse({ results: { bindings: [] } }));

    await new SparqlClient(config).query("SELECT 1");
    let headers = spy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();

    await new SparqlClient({ ...config, username: "u", password: "p" }).query("SELECT 1");
    headers = spy.mock.calls[1][1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Basic ${btoa("u:p")}`);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [405, "forbidden"],
    [500, "server"],
  ])("classifies HTTP %i as a SparqlError with code %s", async (status, code) => {
    mockFetch(async () => errorResponse(status as number));
    const client = new SparqlClient(config);
    await expect(client.query("SELECT 1")).rejects.toMatchObject({
      name: "SparqlError",
      code,
      status,
    });
  });

  it("wraps a network failure as a SparqlError with code 'network'", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const client = new SparqlClient(config);
    const err = await client.query("SELECT 1").catch((e) => e);
    expect(err).toBeInstanceOf(SparqlError);
    expect(err.code).toBe("network");
  });

  it("re-throws an AbortError untouched (cancellation, not a network error)", async () => {
    mockFetch(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    const client = new SparqlClient(config);
    const err = await client.query("SELECT 1").catch((e) => e);
    expect(err).not.toBeInstanceOf(SparqlError);
    expect(err.name).toBe("AbortError");
  });
});

describe("SparqlClient.update", () => {
  it("POSTs to the /statements endpoint", async () => {
    const spy = mockFetch(
      async () =>
        ({ ok: true, status: 204, statusText: "No Content" }) as Response,
    );
    await new SparqlClient(config).update("INSERT DATA {}");
    expect(spy.mock.calls[0][0]).toBe(`${config.url}/statements`);
  });

  it("classifies a 403 write rejection as 'forbidden'", async () => {
    mockFetch(async () => errorResponse(403, "Forbidden"));
    const err = await new SparqlClient(config).update("INSERT DATA {}").catch((e) => e);
    expect(err).toBeInstanceOf(SparqlError);
    expect(err.code).toBe("forbidden");
  });
});
