/**
 * Shared text formatting utilities used across manifestation and expression components.
 */

/**
 * Separator characters for structured strings built with SPARQL GROUP_CONCAT/CONCAT
 * and parsed client-side. These use Unicode characters that will not appear in
 * natural-language labels, URIs, or ISBD bibliographic data, avoiding the ambiguity
 * of using `;`, `:`, `&`, or `=` which occur naturally in those contexts.
 *
 * Used in: useSearchQueries.ts (SPARQL generation), Expression.tsx and
 * textFormatters.ts (client-side parsing).
 */
export const SPARQL_SEP = {
  /** Between relationship/role groups — e.g. "role1‡names §§ role2‡names" */
  GROUP: " §§ ",
  /** Between role label and content — e.g. "forfatter ‡ Navn1 † Navn2" */
  LABEL: " ‡ ",
  /** Between name entries within a group — e.g. "Name1†uri1 † Name2†uri2" */
  NAME: " † ",
  /** Between a name and its URI — e.g. "Cormac McCarthy ‖ http://viaf.org/..." */
  URI: " ‖ ",
} as const;

/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirstLetter = (text: string | undefined): string | undefined => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Splits a pipe-separated string into an array of trimmed, non-empty values.
 * Used for manifestation data fields (notes, identifiers, etc.).
 */
export const splitPipeValues = (value: string | undefined): string[] => {
  if (!value) return [];
  return value.split(/\s*\|\s*/).map(v => v.trim()).filter(v => v.length > 0);
};

/**
 * Splits a semicolon-separated string into an array of trimmed, non-empty values.
 * Used for expression data fields (language, content type, etc.).
 */
export const splitSemicolonValues = (value: string | undefined): string[] => {
  if (!value) return [];
  return value.split(/\s*;\s*/).map(v => v.trim()).filter(v => v.length > 0);
};

export interface CreatorEntry {
  name: string;
  uri?: string;
}

export interface CreatorGroup {
  role: string;
  names: CreatorEntry[];
}

/**
 * Parses a creator string into structured role/name groups.
 *
 * Input format (using SPARQL_SEP characters):
 *   "rolelabel ‡ name ‖ uri † name ‖ uri §§ rolelabel ‡ name ‖ uri"
 * The "‖ uri" part is optional per name entry.
 *
 * @returns Array of { role, names: Array<{ name, uri? }> }
 */
export const parseCreators = (creatorString: string | undefined): CreatorGroup[] => {
  if (!creatorString) return [];

  const roleGroups = creatorString.split(SPARQL_SEP.GROUP).map(group => group.trim());

  return roleGroups.flatMap(group => {
    const labelIndex = group.indexOf(SPARQL_SEP.LABEL.trim());
    if (labelIndex === -1) return [];

    const role = group.substring(0, labelIndex).trim();
    const namesString = group.substring(labelIndex + SPARQL_SEP.LABEL.trim().length).trim();
    const names = namesString.split(SPARQL_SEP.NAME).map(entry => {
      const parts = entry.trim().split(SPARQL_SEP.URI);
      return {
        name: parts[0]?.trim() || '',
        uri: parts.length > 1 ? parts[1]?.trim() : undefined,
      };
    }).filter(entry => entry.name.length > 0);

    return [{ role, names }];
  });
};

export interface ManifestationLike {
  title?: string;
  other?: string;
  responsibilityStatement?: string;
  edition?: string;
  place?: string;
  publisher?: string;
  date?: string;
  extent?: string;
  dimensions?: string;
  series?: string;
  seriesNumbering?: string;
  notes?: string;
  identifiers?: string;
  uri: string;
}

/**
 * Formats the title area line: "Title proper : Other title information / Statement of responsibility"
 */
export const formatTitleArea = (m: ManifestationLike): string => {
  if (!m.title) return m.uri;

  let formatted = m.title;
  if (m.other) {
    formatted += ` : ${m.other}`;
  }
  if (m.responsibilityStatement) {
    formatted += ` / ${m.responsibilityStatement}`;
  }
  return formatted;
};

/**
 * Formats the publication area + physical description + series line using ISBD punctuation.
 * (Edition . – Place : Publisher , Date . – Extent ; Dimensions . – (Series ; Numbering))
 */
export const formatPublicationPhysicalSeries = (m: ManifestationLike): string | null => {
  const parts: string[] = [];

  // Publication area
  if (m.edition) {
    parts.push(m.edition);
  }

  const pubParts: string[] = [];
  if (m.place) {
    pubParts.push(m.place);
  }
  if (m.publisher) {
    pubParts.push(m.place ? ` : ${m.publisher}` : m.publisher);
  }
  if (m.date) {
    pubParts.push(pubParts.length > 0 ? ` , ${m.date}` : m.date);
  }

  if (pubParts.length > 0) {
    if (parts.length > 0) {
      parts.push(` . – ${pubParts.join('')}`);
    } else {
      parts.push(pubParts.join(''));
    }
  }

  // Physical description
  const physParts: string[] = [];
  if (m.extent) {
    physParts.push(m.extent);
  }
  if (m.dimensions) {
    physParts.push(m.extent ? ` ; ${m.dimensions}` : m.dimensions);
  }

  if (physParts.length > 0) {
    if (parts.length > 0) {
      parts.push(` . – ${physParts.join('')}`);
    } else {
      parts.push(physParts.join(''));
    }
  }

  // Series
  if (m.series || m.seriesNumbering) {
    let seriesFormatted = '';
    if (m.series) {
      seriesFormatted = m.series;
    }
    if (m.seriesNumbering) {
      seriesFormatted += seriesFormatted ? ` ; ${m.seriesNumbering}` : m.seriesNumbering;
    }
    if (seriesFormatted) {
      if (parts.length > 0) {
        parts.push(` . – (${seriesFormatted})`);
      } else {
        parts.push(`(${seriesFormatted})`);
      }
    }
  }

  return parts.length > 0 ? parts.join('') : null;
};

/**
 * Formats notes from a pipe-separated string into a semicolon-separated display string.
 */
export const formatNotes = (notes: string | undefined): string | null => {
  if (!notes) return null;
  return splitPipeValues(notes).join(' ; ');
};

/**
 * Formats identifiers from a pipe-separated string into a semicolon-separated display string.
 */
export const formatIdentifiers = (identifiers: string | undefined): string | null => {
  if (!identifiers) return null;
  return splitPipeValues(identifiers).join(' ; ');
};
