/**
 * What a manifestation entry shows besides its own fields, wherever it appears
 * (the publication search, and the list of publications under an expression).
 *
 * The entry presents one expression and its work together with the
 * manifestation, so it reads as one piece of content and not as a publication
 * followed by a separate item: its only expression, or else the one collection
 * among several (an expression whose work has a genre marked
 * `entedit:collection true`, such as a short story collection). The other
 * expressions are its contents. Two or more collections, or none among several
 * expressions, merge nothing: every expression is then a content.
 *
 * Listed under an expression, the entry follows the same rule, except that it
 * does not repeat that expression, which is the row above: a manifestation of
 * one expression would otherwise repeat the row for every publication of it.
 * Contents stay full: the expression it is listed under is one of them unless
 * it is the collection itself.
 */
export interface ManifestationShape {
  expression_count?: number;
  collectionCount?: number;
  collectionExpression?: string;
}

export interface ManifestationPresentation {
  /** The manifestation embodies exactly one expression */
  isSingleExpression: boolean;
  /** The collection among several expressions, when there is exactly one */
  collectionUri?: string;
  /** Merge the manifestation's only expression into the entry (fetched through the manifestation) */
  mergeSingleExpression: boolean;
  /** Merge this collection expression into the entry; absent when there is none or it is the parent */
  mergedCollectionUri?: string;
  /** Expressions listed as contents: all but the collection; absent while the count is unknown */
  contentsCount?: number;
  /** Offer the Contents list: a single expression has none to list */
  hasContents: boolean;
}

export const presentManifestation = (
  manifestation: ManifestationShape,
  parentExpressionUri?: string,
): ManifestationPresentation => {
  const isSingleExpression = manifestation.expression_count === 1;
  const collectionUri =
    !isSingleExpression && manifestation.collectionCount === 1
      ? manifestation.collectionExpression
      : undefined;
  return {
    isSingleExpression,
    collectionUri,
    // The only expression of a manifestation listed under an expression is that expression
    mergeSingleExpression: isSingleExpression && !parentExpressionUri,
    mergedCollectionUri: collectionUri && collectionUri !== parentExpressionUri ? collectionUri : undefined,
    contentsCount:
      manifestation.expression_count != null
        ? manifestation.expression_count - (collectionUri ? 1 : 0)
        : undefined,
    hasContents: !isSingleExpression,
  };
};
