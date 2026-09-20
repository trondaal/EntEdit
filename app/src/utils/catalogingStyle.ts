/**
 * How much of an entity's RDF identity the editor puts in front of the user.
 *
 * Two audiences are supported: classic cataloguing, where identifiers and
 * labels are noise that the app can generate, and semantic-web cataloguing,
 * where entering both is part of the exercise. Identifier and label are
 * separate settings, because a cataloguer may well want human-readable labels
 * on the form while URIs stay out of the way.
 */
export interface CatalogingPreferences {
  /** Show the identifier field in the editor's Identity block. */
  showIdentifier: boolean;
  /** Show the labels row in the editor's Identity block. */
  showLabels: boolean;
  /** Refuse to save a new entity until the user has entered an identifier. */
  requireIdentifier: boolean;
  /** Refuse to save a new entity until the user has entered a label. */
  requireLabel: boolean;
}

export type CatalogingStyle = "classic" | "semantic" | "custom";

/** Identifiers and labels stay hidden and are generated silently. */
export const CLASSIC_PREFERENCES: CatalogingPreferences = {
  showIdentifier: false,
  showLabels: false,
  requireIdentifier: false,
  requireLabel: false,
};

/** Both are shown and must be filled in. */
export const SEMANTIC_PREFERENCES: CatalogingPreferences = {
  showIdentifier: true,
  showLabels: true,
  requireIdentifier: true,
  requireLabel: true,
};

/** New installations start in the semantic-web style. */
export const DEFAULT_PREFERENCES: CatalogingPreferences = SEMANTIC_PREFERENCES;

const sameAs = (a: CatalogingPreferences, b: CatalogingPreferences) =>
  a.showIdentifier === b.showIdentifier &&
  a.showLabels === b.showLabels &&
  a.requireIdentifier === b.requireIdentifier &&
  a.requireLabel === b.requireLabel;

/** Which preset these preferences correspond to, or "custom". */
export const styleOf = (preferences: CatalogingPreferences): CatalogingStyle => {
  if (sameAs(preferences, CLASSIC_PREFERENCES)) return "classic";
  if (sameAs(preferences, SEMANTIC_PREFERENCES)) return "semantic";
  return "custom";
};

export const presetFor = (style: CatalogingStyle): CatalogingPreferences =>
  style === "classic" ? CLASSIC_PREFERENCES : SEMANTIC_PREFERENCES;

/**
 * Applies a `?style=classic|semantic` URL parameter, so a teacher can hand out
 * one link instead of having everyone configure the same thing. The override
 * is not persisted: it applies to the session the link opened.
 */
export const applyStyleOverride = (
  preferences: CatalogingPreferences,
  search: string,
): CatalogingPreferences => {
  const style = new URLSearchParams(search).get("style");
  if (style === "classic" || style === "semantic") return presetFor(style);
  return preferences;
};
