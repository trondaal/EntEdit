/**
 * The relationship lines of a search result ("Has part: …", "Is translation of: …")
 * can be switched off one relationship at a time (`hiddenRelationships`). The same
 * relationship is often stated at more than one level, or from both sides, and which
 * lines are wanted depends on the collection, so it is the user's choice, not a hidden
 * merge: the data and the queries are the same whatever it says, it only decides which
 * lines are shown. Nothing is hidden unless the user chooses.
 *
 * A line carries the property it is shown with: the one that was stated, or for a
 * statement stored on the other side its `owl:inverseOf` (resolved by the query), so
 * a link stored in either direction is matched by the same URI. Sub-properties are
 * not followed: a statement made with a sub-property has its own line and its own
 * entry in the list.
 */

/** The relationship properties the user has chosen not to see, as URIs. */
export type HiddenRelationships = readonly string[];

export const NO_HIDDEN_RELATIONSHIPS: HiddenRelationships = [];

const isUri = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\/\S+$/.test(value);

/** A stored value, or nothing hidden for anything unusable; sorted and without repeats. */
export const toHiddenRelationships = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isUri))].sort() : [];

const RDA = "http://rdaregistry.info/Elements/";

const WORK_PART_PAIR = [`${RDA}w/object/P10019`, `${RDA}w/object/P10147`]; // is part of / has part work
const EXPRESSION_PART_PAIR = [`${RDA}e/object/P20074`, `${RDA}e/object/P20145`]; // is part of / has part expression

/**
 * Before the list there was one preference (`partLevels`: show the part lines of the work,
 * of the expression, or of both). A stored value becomes the lines it left out.
 */
export const hiddenFromPartLevels = (value: unknown): string[] => {
  if (value === "work") return toHiddenRelationships(EXPRESSION_PART_PAIR);
  if (value === "expression") return toHiddenRelationships(WORK_PART_PAIR);
  return [];
};

/** Whether a relationship line is hidden. A line of unknown property is never hidden. */
export const isHiddenRelationship = (
  propertyUri: string | undefined,
  hidden: ReadonlySet<string>,
): boolean => !!propertyUri && hidden.has(propertyUri);

/** The list with `uris` hidden or shown again. */
export const withHidden = (
  hidden: HiddenRelationships,
  uris: readonly string[],
  hide: boolean,
): string[] => {
  const next = new Set(hidden);
  for (const uri of uris) {
    if (hide) next.add(uri);
    else next.delete(uri);
  }
  return [...next].sort();
};

/** The two lists hold the same relationships, whatever their order. */
export const sameHidden = (a: HiddenRelationships, b: HiddenRelationships): boolean =>
  a.length === b.length && a.every((uri) => b.includes(uri));
