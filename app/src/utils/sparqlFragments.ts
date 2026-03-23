/**
 * Utility functions for generating reusable SPARQL query fragments
 */

/**
 * Generates a SPARQL fragment for language-aware label selection with fallback
 *
 * This creates an OPTIONAL pattern that selects labels in the following priority:
 * 1. Label in the selected language
 * 2. Label without language tag (language-neutral)
 * 3. Label in the fallback language
 *
 * @param subject - The SPARQL variable for the subject (e.g., "?property", "?entity")
 * @param language - The primary language code (e.g., "en", "no")
 * @param fallbackLanguage - The fallback language code (e.g., "en", "no")
 * @param labelVar - The base name for the label variable (default: "label")
 * @param useLanguageMatches - Whether to use LANGMATCHES for chosen language (default: true)
 * @returns SPARQL fragment as a string
 *
 * @example
 * ```typescript
 * const fragment = createLanguageFallbackFragment("?entity", "en", "no");
 * // Returns SPARQL that will bind ?label with the best matching label
 * ```
 */
export const createLanguageFallbackFragment = (
  subject: string,
  language: string,
  fallbackLanguage: string,
  labelVar: string = "label",
  useLanguageMatches: boolean = true,
): string => {
  const chosenFilter = useLanguageMatches
    ? `FILTER(LANGMATCHES(LANG(?${labelVar}_chosen), "${language}")) .`
    : `FILTER(LANG(?${labelVar}_chosen) = "${language}") .`;

  return `
          # Choosing label in the priority order chosen, none, fallback
          OPTIONAL {
            ${subject} rdfs:label ?${labelVar}_chosen .
            ${chosenFilter}
          }
          OPTIONAL {
            ${subject} rdfs:label ?${labelVar}_none .
            FILTER(LANG(?${labelVar}_none) = "") .
          }
          # Fallback to Norwegian if English, or English if Norwegian
          OPTIONAL {
            ${subject} rdfs:label ?${labelVar}_fallback .
            FILTER(LANG(?${labelVar}_fallback) = "${fallbackLanguage}") .
          }
          BIND(COALESCE(?${labelVar}_chosen, ?${labelVar}_none, ?${labelVar}_fallback) AS ?${labelVar})`;
};

/**
 * Generates a SPARQL fragment for schema label selection (classes and properties).
 *
 * For schema elements, labels are expected to have a language tag. The fallback
 * priority is: chosen language → English. Untagged labels are not considered —
 * missing language tags should be fixed in the data rather than worked around.
 *
 * @param subject - The SPARQL variable for the subject (e.g., "?class", "?property")
 * @param language - The primary language code (e.g., "en", "no")
 * @param labelVar - The base name for the label variable (default: "label")
 * @returns SPARQL fragment as a string
 */
export const createSchemaLabelFragment = (
  subject: string,
  language: string,
  labelVar: string = "label",
): string => {
  return `
          OPTIONAL {
            ${subject} rdfs:label ?${labelVar}_chosen .
            FILTER(LANGMATCHES(LANG(?${labelVar}_chosen), "${language}")) .
          }
          OPTIONAL {
            ${subject} rdfs:label ?${labelVar}_en .
            FILTER(LANGMATCHES(LANG(?${labelVar}_en), "en")) .
          }
          BIND(COALESCE(?${labelVar}_chosen, ?${labelVar}_en) AS ?${labelVar})`;
};

/**
 * Determines the fallback language based on the primary language
 * Currently supports English <-> Norwegian fallback
 *
 * @param language - The primary language code
 * @returns The fallback language code
 */
export const getFallbackLanguage = (language: string): string => {
  return language === "no" ? "en" : "no";
};

/** Languages supported by the application */
export const SUPPORTED_LANGUAGES = ["en", "no"] as const;
