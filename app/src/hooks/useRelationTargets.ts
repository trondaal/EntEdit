import { useInfiniteQuery } from "@tanstack/react-query";
import { SparqlClient } from "../utils/sparqlClient";
import { buildRelationTargetsQuery } from "../utils/wemiQueries";
import type { SparqlEndpointConfig } from "../types/sparql";

/** Targets fetched per page of an opened relationship. */
export const RELATION_PAGE_SIZE = 50;

const TARGET_CLASS = {
  work: "http://rdaregistry.info/Elements/c/C10001",
  expression: "http://rdaregistry.info/Elements/c/C10006",
  manifestation: "http://rdaregistry.info/Elements/c/C10007",
} as const;

export interface RelationTarget {
  uri: string;
  /** Empty when the target has no label at all */
  title: string;
}

interface RelationTargetsParams {
  /** The entity whose relationship is opened */
  entityUri: string;
  /** The property the result line was shown with (`collapsedRelationshipsSubquery`) */
  propertyUri: string;
  /** What the targets are */
  kind: keyof typeof TARGET_CLASS;
  language: string;
  /** Only when the relationship is open: a collapsed one costs nothing */
  enabled: boolean;
}

/**
 * The targets of one relationship marked `entedit:collapse true`, loaded when
 * the user opens it, by title and a page at a time.
 */
export const useRelationTargets = (
  config: SparqlEndpointConfig,
  { entityUri, propertyUri, kind, language, enabled }: RelationTargetsParams,
) =>
  useInfiniteQuery({
    queryKey: ["relation-targets", config.url, entityUri, propertyUri, kind, language],
    queryFn: async ({ pageParam = 0, signal }): Promise<RelationTarget[]> => {
      const response = await new SparqlClient(config).query(
        buildRelationTargetsQuery(
          entityUri,
          propertyUri,
          TARGET_CLASS[kind],
          language,
          RELATION_PAGE_SIZE,
          pageParam,
        ),
        { signal },
      );
      return response.results.bindings.map((binding) => ({
        uri: binding.target.value,
        title: binding.target_title?.value ?? "",
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < RELATION_PAGE_SIZE ? undefined : lastPageParam + RELATION_PAGE_SIZE,
    enabled: enabled && !!config.url && !!entityUri && !!propertyUri,
  });
