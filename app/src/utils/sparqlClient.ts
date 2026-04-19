import type { SparqlEndpointConfig, SparqlResponse } from "../types/sparql";

/** Options accepted by read methods. `signal` is typically the `signal`
 * provided by TanStack Query's `queryFn` context, forwarded to `fetch` so
 * cancelled queries also cancel their in-flight HTTP request. */
export interface SparqlQueryOptions {
  signal?: AbortSignal;
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

    const response = await fetch(`${this.config.url}/statements`, {
      method: "POST",
      headers,
      body: sparql,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`SPARQL update failed: ${response.status} ${response.statusText}. ${errorText}`);
    }
  }
}
