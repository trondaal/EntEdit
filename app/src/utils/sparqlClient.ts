import type { SparqlEndpointConfig, SparqlResponse } from "../types/sparql";

/** Options accepted by read methods. `signal` is typically the `signal`
 * provided by TanStack Query's `queryFn` context, forwarded to `fetch` so
 * cancelled queries also cancel their in-flight HTTP request. */
export interface SparqlQueryOptions {
  signal?: AbortSignal;
}

/** Classification for SPARQL request failures so UI layers can show a
 * user-friendly message without parsing error strings.
 *  - `network`: fetch itself rejected (TypeError) — offline, DNS, CORS,
 *    mixed-content, etc. Indistinguishable from the browser's side.
 *  - `unauthorized`: 401 — credentials missing or wrong.
 *  - `forbidden`: 403 or 405 — endpoint refuses the operation (typically
 *    a read-only demo repository rejecting writes).
 *  - `server`: any other non-OK status. */
export type SparqlErrorCode =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "server";

export class SparqlError extends Error {
  readonly code: SparqlErrorCode;
  readonly status?: number;
  constructor(code: SparqlErrorCode, message: string, status?: number) {
    super(message);
    this.name = "SparqlError";
    this.code = code;
    this.status = status;
  }
}

/** Maps an HTTP status to a SparqlErrorCode. 401 → unauthorized,
 * 403/405 → forbidden (read-only endpoint), anything else → server. */
function classifyStatus(status: number): SparqlErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403 || status === 405) return "forbidden";
  return "server";
}

export class SparqlClient {
  private config: SparqlEndpointConfig;

  constructor(config: SparqlEndpointConfig) {
    this.config = config;
  }

  /** Builds request headers, adding HTTP Basic auth when credentials are set. */
  private buildHeaders(base: Record<string, string>): Record<string, string> {
    const headers = { ...base };
    if (this.config.username && this.config.password) {
      const encodedAuth = btoa(
        `${this.config.username}:${this.config.password}`,
      );
      headers["Authorization"] = `Basic ${encodedAuth}`;
    }
    return headers;
  }

  async query(
    sparql: string,
    options?: SparqlQueryOptions,
  ): Promise<SparqlResponse> {
    return this.queryWithInference(sparql, true, options);
  }

  async queryWithoutInference(
    sparql: string,
    options?: SparqlQueryOptions,
  ): Promise<SparqlResponse> {
    return this.queryWithInference(sparql, false, options);
  }

  private async queryWithInference(
    sparql: string,
    infer: boolean,
    options?: SparqlQueryOptions,
  ): Promise<SparqlResponse> {
    const formData = new URLSearchParams({
      query: sparql,
      format: "application/sparql-results+json",
      infer: infer.toString(),
    });

    const headers = this.buildHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    });

    let response: Response;
    try {
      response = await fetch(`${this.config.url}`, {
        method: "POST",
        headers,
        body: formData,
        signal: options?.signal,
      });
    } catch (err) {
      // Re-throw aborts untouched so TanStack Query treats them as cancellations
      // rather than surfacing a "network" error to the user.
      if ((err as Error).name === "AbortError") throw err;
      // fetch() rejects only for network-level failures (TypeError): offline,
      // DNS, CORS preflight rejection, mixed-content, etc. The browser hides which.
      throw new SparqlError(
        "network",
        `SPARQL query network error: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "No additional error info");
      throw new SparqlError(
        classifyStatus(response.status),
        `SPARQL query failed: ${response.status} ${response.statusText}. ${errorText}`,
        response.status,
      );
    }

    return response.json();
  }

  /** POST RDF data to the repository's statements endpoint. If `graphUri` is
   * provided, the data is loaded into that named graph via `?context=<uri>`;
   * otherwise it goes into the default graph. Append-only — does not clear
   * the target graph first. */
  async import(
    data: string | Blob,
    contentType: string,
    graphUri?: string,
  ): Promise<void> {
    const headers = this.buildHeaders({ "Content-Type": contentType });

    const trimmed = graphUri?.trim();
    const url = trimmed
      ? `${this.config.url}/statements?context=${encodeURIComponent(`<${trimmed}>`)}`
      : `${this.config.url}/statements`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: data,
      });
    } catch (err) {
      throw new SparqlError(
        "network",
        `RDF import network error: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new SparqlError(
        classifyStatus(response.status),
        `RDF import failed: ${response.status} ${response.statusText}. ${errorText}`,
        response.status,
      );
    }
  }

  async update(sparql: string): Promise<void> {
    const headers = this.buildHeaders({
      "Content-Type": "application/sparql-update",
    });

    let response: Response;
    try {
      response = await fetch(`${this.config.url}/statements`, {
        method: "POST",
        headers,
        body: sparql,
      });
    } catch (err) {
      // fetch() rejects only for network-level failures (TypeError): offline,
      // DNS, CORS preflight rejection, mixed-content, etc. The browser deliberately
      // hides which one it is. Treat all of them as "network".
      throw new SparqlError(
        "network",
        `SPARQL update network error: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new SparqlError(
        classifyStatus(response.status),
        `SPARQL update failed: ${response.status} ${response.statusText}. ${errorText}`,
        response.status,
      );
    }
  }
}
