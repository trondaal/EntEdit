import type { TFunction } from "i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import { SparqlClient } from "./sparqlClient";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: string;
  /** The endpoint answered and holds data; false for a reachable, empty one. */
  hasData: boolean;
}

/** Whether two endpoint settings address the same server with the same login. */
export const sameConnection = (
  a: SparqlEndpointConfig,
  b: SparqlEndpointConfig,
): boolean =>
  a.url.trim() === b.url.trim() &&
  (a.username ?? "") === (b.username ?? "") &&
  (a.password ?? "") === (b.password ?? "");

/** Runs a trivial query against the endpoint and explains any failure. */
export async function testEndpointConnection(
  config: SparqlEndpointConfig,
  t: TFunction,
): Promise<ConnectionTestResult> {
  if (!config.url.trim()) {
    return { success: false, hasData: false, message: t("wizard.testResult.noUrl") };
  }

  try {
    const response = await new SparqlClient(config).query(
      "SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o . } LIMIT 1",
    );

    if (response.results.bindings.length > 0) {
      return {
        success: true,
        hasData: true,
        message: t("wizard.testResult.success"),
        details: t("wizard.testResult.successDetails"),
      };
    }
    return {
      success: true,
      hasData: false,
      message: t("wizard.testResult.empty"),
      details: t("wizard.testResult.emptyDetails"),
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    let message = t("wizard.testResult.failed");
    let details = errorMessage;

    if (errorMessage.includes("401")) {
      message = t("wizard.testResult.unauthorized");
      details = t("wizard.testResult.unauthorizedDetails");
    } else if (errorMessage.includes("403")) {
      message = t("wizard.testResult.forbidden");
      details = t("wizard.testResult.forbiddenDetails");
    } else if (errorMessage.includes("404")) {
      message = t("wizard.testResult.notFound");
      details = t("wizard.testResult.notFoundDetails");
    } else if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("Load failed")
    ) {
      message = t("wizard.testResult.network");
      details = t("wizard.testResult.networkDetails");
    } else if (errorMessage.includes("CORS")) {
      message = t("wizard.testResult.cors");
      details = t("wizard.testResult.corsDetails");
    }

    return { success: false, hasData: false, message, details };
  }
}
