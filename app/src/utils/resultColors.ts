/**
 * Background colours of the nested parts of a search result: a work's expressions, an
 * expression's publications, a publication's contents.
 *
 *  - "level" (the default): each level of the hierarchy has one opaque shade, lighter at the top
 *    and darker the deeper it is, for lists and for the cards in them alike. The top-level result
 *    is white, and a card inside an opened list has no border.
 *  - "type" (`?colors=type` in the address): the earlier scheme. Every opened list has the same
 *    translucent tint and a card inside a list is white, so the shade follows the kind of box:
 *    nested lists stack the tint and it returns to white at the next card.
 */
export type ResultColors = "type" | "level";

/** Level 0 is the result at the top of a search tab, 1 what its first opened list shows, and so on. */
export const LEVEL_BACKGROUNDS = ["#ffffff", "#f4eee8", "#ebe1d6", "#e1d3c4", "#d7c5b2"] as const;

export const levelBackground = (level: number): string =>
  LEVEL_BACKGROUNDS[Math.max(0, Math.min(level, LEVEL_BACKGROUNDS.length - 1))];

const TYPE_SECTION_BACKGROUND = "rgba(139, 92, 42, 0.12)";

/** The mode the address asks for; anything but `type` is the default, `level`. */
export const toResultColors = (value: string | null | undefined): ResultColors =>
  value === "type" ? "type" : "level";

/** Background of a card: a result at the top, or a publication or expression in an opened list. */
export const cardBackground = (colors: ResultColors, level: number): string =>
  colors === "level" ? levelBackground(level) : "background.paper";

/**
 * Width of a card's border. In level mode a card inside an opened list has none: it already has
 * the list's shade, and the border only drew a box around it. Results at the top keep theirs.
 */
export const cardBorder = (colors: ResultColors, level: number): 0 | 1 =>
  colors === "level" && level > 0 ? 0 : 1;

/** Style of an opened list, at the level its entries have. */
export const sectionStyle = (colors: ResultColors, level: number) =>
  ({
    bgcolor: colors === "level" ? levelBackground(level) : TYPE_SECTION_BACKGROUND,
    borderTop: 1,
    borderColor: "divider",
  }) as const;
