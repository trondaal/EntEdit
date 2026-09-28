/**
 * Ordering by `entedit:valueOrder`, the position the cataloguer gave a value
 * in the editor, stored as an RDF-star annotation on the statement:
 *
 *   << <subject> <property> <value> >> entedit:valueOrder 0 .
 *
 * Read it with an OPTIONAL next to the statement, from the subject's side
 * (the order of an incoming link is stored on the other entity), e.g.
 *
 *   OPTIONAL { << <manifestation> rdamo:P30139 ?expression >> entedit:valueOrder ?order }
 *
 * and sort in the app: SPARQL gives no order within GROUP_CONCAT, and most
 * data (imported, never reordered) has no annotation at all. See CLAUDE.md,
 * "Value order".
 */

/**
 * Sorts values with a recorded order first, by that order; the rest follow,
 * ordered by `fallback` (or kept in their current order without one).
 * Returns a new array.
 */
export function sortByValueOrder<T>(
  items: readonly T[],
  orderOf: (item: T) => number | undefined,
  fallback?: (a: T, b: T) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index, order: orderOf(item) }))
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order || a.index - b.index;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return (fallback?.(a.item, b.item) ?? 0) || a.index - b.index;
    })
    .map(({ item }) => item);
}
