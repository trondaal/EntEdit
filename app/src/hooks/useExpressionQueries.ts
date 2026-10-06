import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  buildExpressionDetailQuery,
  expressionOrderInManifestation,
  expressionOrderInWork,
  expressionScope,
  expressionsOfManifestation,
  expressionsOfWork,
  toExpressionDetail,
} from "../utils/wemiQueries";
import { sortByValueOrder } from "../utils/valueOrder";

export interface Expression {
  uri: string;
  title?: string;
  work_title?: string;
  language?: string;
  contenttype?: string;
  contenttypeUri?: string;
  workcategory?: string;
  genre?: string;
  work_creators?: string;
  expression_creators?: string;
  work_to_work_relationships?: string;
  expression_to_expression_relationships?: string;
  manifestation_count?: number;
}

export const useExpressionsByManifestation = (
  config: SparqlEndpointConfig,
  manifestationUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: [
      "expressionsByManifestation",
      config.url,
      manifestationUri,
      language,
    ],
    queryFn: async ({ signal }): Promise<Expression[]> => {
      if (!manifestationUri) {
        return [];
      }

      const client = new SparqlClient(config);
      const response = await client.query(
        buildExpressionDetailQuery(
          expressionsOfManifestation(manifestationUri),
          language,
          expressionOrderInManifestation(manifestationUri),
        ),
        { signal },
      );
      const expressions = response.results.bindings
        .map(toExpressionDetail)
        .map(({ expression_title, ...rest }) => ({ ...rest, title: expression_title }));
      // Contents in the order recorded in the editor; unordered ones by title
      return sortByValueOrder(
        expressions,
        (e) => e.valueOrder,
        (a, b) =>
          (a.title ?? a.work_title ?? a.uri).localeCompare(b.title ?? b.work_title ?? b.uri),
      );
    },
    enabled: Boolean(manifestationUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/** Details of one expression, e.g. the collection a publication is presented as. */
export const useExpressionDetail = (
  config: SparqlEndpointConfig,
  expressionUri: string | null | undefined,
  language: string,
) => {
  return useQuery({
    queryKey: ["expressionDetail", config.url, expressionUri, language],
    queryFn: async ({ signal }): Promise<Expression | null> => {
      if (!expressionUri) return null;
      const client = new SparqlClient(config);
      const response = await client.query(
        buildExpressionDetailQuery(expressionScope([expressionUri]), language),
        { signal },
      );
      const detail = response.results.bindings.map(toExpressionDetail)[0];
      if (!detail) return null;
      const { expression_title, ...rest } = detail;
      return { ...rest, title: expression_title };
    },
    enabled: Boolean(expressionUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Expressions of a work, for the list under a work search result: in the
 * order recorded on the work in the editor, the rest by language and title.
 */
export const useExpressionsByWork = (
  config: SparqlEndpointConfig,
  workUri: string | null,
  language: string,
) => {
  return useQuery({
    queryKey: ["expressionsByWork", config.url, workUri, language],
    queryFn: async ({ signal }): Promise<Expression[]> => {
      if (!workUri) return [];
      const client = new SparqlClient(config);
      const response = await client.query(
        buildExpressionDetailQuery(expressionsOfWork(workUri), language, expressionOrderInWork(workUri)),
        { signal },
      );
      const expressions = response.results.bindings
        .map(toExpressionDetail)
        .map(({ expression_title, ...rest }) => ({ ...rest, title: expression_title }));
      return sortByValueOrder(
        expressions,
        (e) => e.valueOrder,
        (a, b) =>
          (a.language ?? "").localeCompare(b.language ?? "") ||
          (a.title ?? a.work_title ?? a.uri).localeCompare(b.title ?? b.work_title ?? b.uri),
      );
    },
    enabled: Boolean(workUri),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
