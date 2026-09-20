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
  /**
   * Show the language of a text value, and let the user set it while editing.
   * Part of the style: tagging values by language is a semantic-web concern.
   * Even when off, values of one property that differ in language still show
   * their tag — otherwise they would look like duplicates of each other.
   */
  showLanguageTags: boolean;
  /**
   * Mark values the database inferred rather than stored, with a chip and a
   * dashed outline. Useful when the difference is being taught, noise when it
   * is not — the values behave the same either way.
   *
   * Independent of the cataloguing style: it is off in both presets, keeps its
   * value when a preset is applied, and does not make the style read "custom".
   */
  showInferredMarks: boolean;
}

export type CatalogingStyle = "classic" | "semantic" | "custom";

/** Identifiers and labels stay hidden and are generated silently. */
export const CLASSIC_PREFERENCES: CatalogingPreferences = {
  showIdentifier: false,
  showLabels: false,
  requireIdentifier: false,
  requireLabel: false,
  showLanguageTags: false,
  showInferredMarks: false,
};

/** Both are shown and must be filled in. */
export const SEMANTIC_PREFERENCES: CatalogingPreferences = {
  showIdentifier: true,
  showLabels: true,
  requireIdentifier: true,
  requireLabel: true,
  showLanguageTags: true,
  showInferredMarks: false,
};

/** New installations start in the semantic-web style. */
export const DEFAULT_PREFERENCES: CatalogingPreferences = SEMANTIC_PREFERENCES;

// showInferredMarks is deliberately not compared: it belongs to no style.
const sameAs = (a: CatalogingPreferences, b: CatalogingPreferences) =>
  a.showIdentifier === b.showIdentifier &&
  a.showLabels === b.showLabels &&
  a.requireIdentifier === b.requireIdentifier &&
  a.requireLabel === b.requireLabel &&
  a.showLanguageTags === b.showLanguageTags;

/** Which preset these preferences correspond to, or "custom". */
export const styleOf = (preferences: CatalogingPreferences): CatalogingStyle => {
  if (sameAs(preferences, CLASSIC_PREFERENCES)) return "classic";
  if (sameAs(preferences, SEMANTIC_PREFERENCES)) return "semantic";
  return "custom";
};

export const presetFor = (style: CatalogingStyle): CatalogingPreferences =>
  style === "classic" ? CLASSIC_PREFERENCES : SEMANTIC_PREFERENCES;

/**
 * Applies a preset while keeping the settings that are not part of a style,
 * so choosing a style never silently changes them.
 */
export const applyPreset = (
  style: CatalogingStyle,
  current: CatalogingPreferences,
): CatalogingPreferences => ({
  ...presetFor(style),
  showInferredMarks: current.showInferredMarks,
});

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
  if (style === "classic" || style === "semantic") {
    return applyPreset(style, preferences);
  }
  return preferences;
};
