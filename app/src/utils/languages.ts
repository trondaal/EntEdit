/**
 * Languages offered when tagging a text value.
 *
 * A fixed list rather than free text: a mistyped tag is invalid RDF and hard
 * to notice afterwards. It covers the interface languages, the Nordic
 * languages, and the ones that turn up most often in Norwegian bibliographic
 * data. `nb`/`nn` are listed next to `no` because catalogues use all three.
 */
export const VALUE_LANGUAGES = [
  "no",
  "nb",
  "nn",
  "en",
  "da",
  "sv",
  "is",
  "fi",
  "de",
  "nl",
  "fr",
  "es",
  "it",
  "pt",
  "pl",
  "ru",
  "ar",
  "zh",
  "ja",
  "la",
] as const;

/**
 * Name of a language in the interface language, e.g. "nn" → "Norwegian
 * Nynorsk" or "nynorsk". Falls back to the bare code where the browser has no
 * name for it.
 */
export const languageName = (code: string, uiLanguage: string): string => {
  try {
    const names = new Intl.DisplayNames([uiLanguage], { type: "language" });
    const name = names.of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
};

/**
 * The distinct languages used by a property's values, with an untagged value
 * counting as "". More than one means the values cannot be told apart without
 * showing their tags.
 */
export const languagesInUse = (
  values: Array<{ value: string; lang?: string }>,
): Set<string> =>
  new Set(values.filter((v) => v.value.trim()).map((v) => v.lang ?? ""));
