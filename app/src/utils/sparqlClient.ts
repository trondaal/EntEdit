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

export class SparqlClient {
  private config: SparqlEndpointConfig;

  constructor(config: SparqlEndpointConfig) {
    this.config = config;
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

    const headers: HeadersInit = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    };

    if (this.config.username && this.config.password) {
      const authString = `${this.config.username}:${this.config.password}`;
      const encodedAuth = btoa(authString);
      headers["Authorization"] = `Basic ${encodedAuth}`;
    }

    const response = await fetch(`${this.config.url}`, {
      method: "POST",
      headers,
      body: formData,
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No additional error info');
      throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  async update(sparql: string): Promise<void> {
    const headers: HeadersInit = {
      "Content-Type": "application/sparql-update",
    };

    if (this.config.username && this.config.password) {
      const authString = `${this.config.username}:${this.config.password}`;
      const encodedAuth = btoa(authString);
      headers["Authorization"] = `Basic ${encodedAuth}`;
    }

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
      const code: SparqlErrorCode =
        response.status === 401
          ? "unauthorized"
          : response.status === 403 || response.status === 405
            ? "forbidden"
            : "server";
      throw new SparqlError(
        code,
        `SPARQL update failed: ${response.status} ${response.statusText}. ${errorText}`,
        response.status,
      );
    }
  }
}
