/**
 * Utility functions for formatting RDF labels and URIs
 */

/**
 * Formats an RDF label by capitalizing the first character
 * @param label - The label to format
 * @param uri - Optional URI to extract fragment from if label is not provided
 * @param capitalize - Whether to capitalize the first character (default: true)
 * @returns Formatted label string
 */
export const formatLabel = (
  label?: string,
  uri?: string,
  capitalize = true,
): string => {
  const text = label || extractUriFragment(uri || "") || uri || "";
  return capitalize && text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
};

/**
 * Extracts the fragment or last segment from a URI
 * @param uri - The URI to extract from
 * @returns The extracted fragment or last path segment
 */
export const extractUriFragment = (uri: string): string => {
  if (!uri) return "";
  // Prefer the hash fragment; otherwise fall back to the last path segment.
  // Note: `uri.split("#").pop()` returns the whole string when there is no
  // "#", so we must guard with includes("#") — otherwise slash-delimited URIs
  // (e.g. RDA .../Elements/c/C10001) would never be shortened.
  const hashFragment = uri.includes("#") ? uri.split("#").pop() : undefined;
  return hashFragment || uri.split("/").pop() || uri;
};

/**
 * Gets the best label from a list of labels based on language preference
 * @param labels - Array of labels with language tags
 * @param selectedLanguage - Preferred language code
 * @returns The best matching label value or null
 */
export const getPrimaryLabel = (
  labels: Array<{ value: string; language: string }>,
  selectedLanguage: string,
): string | null => {
  if (labels.length === 0) {
    return null;
  }

  // First try to find a label in the selected language
  const selectedLangLabel = labels.find(
    (label) => label.language === selectedLanguage,
  );
  if (selectedLangLabel) {
    return selectedLangLabel.value;
  }

  // Then try to find a label without language tag
  const noLangLabel = labels.find((label) => label.language === "");
  if (noLangLabel) {
    return noLangLabel.value;
  }

  // Finally, return the first available label
  return labels[0].value;
};

/**
 * Escapes a string for use in SPARQL literal values
 * @param value - The string to escape
 * @returns Escaped string safe for SPARQL queries
 */
export const escapeSparqlLiteral = (value: string): string => {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
};

/**
 * Sanitizes a URI for safe interpolation into SPARQL queries within angle brackets.
 * Rejects URIs containing characters that could break out of <...> syntax.
 * @param uri - The URI to sanitize
 * @returns The URI if safe
 * @throws Error if the URI contains unsafe characters
 */
export const sanitizeSparqlUri = (uri: string): string => {
  // eslint-disable-next-line no-control-regex
  if (/[<>"{}|\\^`\x00-\x20]/.test(uri)) {
    throw new Error(`Unsafe URI for SPARQL interpolation: ${uri}`);
  }
  return uri;
};

/**
 * Validates if a string is a valid URI
 * @param uri - The URI to validate
 * @returns true if valid, false otherwise
 */
export const isValidUri = (uri: string): boolean => {
  if (!uri.trim()) return true; // Empty is valid (will auto-generate)
  try {
    new URL(uri);
    return true;
  } catch {
    // Check if it's a valid URI pattern (not necessarily a URL)
    const uriPattern = /^([a-zA-Z][a-zA-Z0-9+.-]*:|\/)/;
    return uriPattern.test(uri);
  }
};
