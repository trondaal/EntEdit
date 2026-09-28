import { useQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  buildExpressionDetailQuery,
  expressionOrderInManifestation,
  expressionsOfManifestation,
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
