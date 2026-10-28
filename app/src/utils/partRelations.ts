/**
 * "Is part of" / "has part" is stated at two levels, between works and between
 * expressions, and the two usually say the same thing: on the isfdb data, 99.9% of
 * the expression-level links have a work-level twin and nearly all work-level links
 * an expression-level one. Showing both makes a result look repeated, and which
 * level a cataloguer wants depends on the collection, so it is a preference
 * (`partLevels`): the data and the queries are the same whatever it says, it only
 * decides which of these lines are shown.
 *
 * Every other relationship is unique to its level and is always shown.
 */

/** Which level's part lines to show. */
export type PartLevels = "both" | "work" | "expression";

export const PART_LEVELS: readonly PartLevels[] = ["both", "work", "expression"];

/** Nothing is hidden unless the user chooses. */
export const DEFAULT_PART_LEVELS: PartLevels = "both";

/** A stored value, or the default for anything unusable. */
export const toPartLevels = (value: unknown): PartLevels =>
  PART_LEVELS.includes(value as PartLevels) ? (value as PartLevels) : DEFAULT_PART_LEVELS;

const RDA = "http://rdaregistry.info/Elements/";

/** The part pair at work level and at expression level, each direction. */
const PART_PROPERTIES: ReadonlySet<string> = new Set([
  `${RDA}w/object/P10019`, // is part of work
  `${RDA}w/object/P10147`, // has part work
  `${RDA}e/object/P20074`, // is part of expression
  `${RDA}e/object/P20145`, // has part expression
]);

export const isPartProperty = (propertyUri: string | undefined): boolean =>
  !!propertyUri && PART_PROPERTIES.has(propertyUri);

/**
 * Whether a relationship line is hidden by the preference: only part lines, and
 * only those of a level the preference leaves out. `level` is the level of the
 * line: work-to-work lines are "work", expression-to-expression ones "expression".
 * Manifestation lines are never hidden: the preference covers only these two levels.
 */
export const isHiddenPartLine = (
  propertyUri: string | undefined,
  level: "work" | "expression" | "manifestation",
  partLevels: PartLevels,
): boolean => isPartProperty(propertyUri) && partLevels !== "both" && partLevels !== level;
