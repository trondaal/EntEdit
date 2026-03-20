/**
 * Shared text formatting utilities used across manifestation and expression components.
 */

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
 * Input format: "rolelabel: name = uri & name = uri ; rolelabel: name = uri"
 * The "= uri" part is optional per name entry.
 *
 * @returns Array of { role, names: Array<{ name, uri? }> }
 */
export const parseCreators = (creatorString: string | undefined): CreatorGroup[] => {
  if (!creatorString) return [];

  const roleGroups = creatorString.split(';').map(group => group.trim());

  return roleGroups.flatMap(group => {
    const colonIndex = group.indexOf(':');
    if (colonIndex === -1) return [];

    const role = group.substring(0, colonIndex).trim();
    const namesString = group.substring(colonIndex + 1).trim();
    const names = namesString.split('&').map(entry => {
      const parts = entry.trim().split(' = ');
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
