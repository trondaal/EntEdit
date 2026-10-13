/**
 * How much of a property's values the editor shows. A property with many
 * values (an author's works, a person's variant names) is cut to its first
 * few, with a button for more, and any property can be collapsed to its
 * heading to see the whole entity at a glance.
 *
 * Only reading is cut or collapsed. While editing, every value is shown: a new
 * value is appended at the end, and empty rows, duplicate marks and
 * drag-to-reorder all need the whole list.
 */

/** Values shown before the "show more" button. */
export const INITIAL_VISIBLE = 5;
/** Values added by each press of "show more". */
export const SHOW_MORE_STEP = 50;
/** A button hiding only this many values or fewer would save nothing: show them. */
const SHORT_TAIL = 2;

export interface ViewMode {
  isEditing: boolean;
  collapsed: boolean;
}

/** How many of `total` values to render. `shown` is how many the user asked for (default `INITIAL_VISIBLE`). */
export const visibleCount = (
  total: number,
  shown: number | undefined,
  { isEditing, collapsed }: ViewMode,
): number => {
  if (isEditing) return total;
  if (collapsed) return 0;
  const wanted = Math.max(shown ?? INITIAL_VISIBLE, INITIAL_VISIBLE);
  return total - wanted <= SHORT_TAIL ? total : wanted;
};

/** The first `visibleCount` items; a prefix, so an index in it is an index in the whole list. */
export const visibleItems = <T>(
  items: readonly T[],
  shown: number | undefined,
  mode: ViewMode,
): readonly T[] => items.slice(0, visibleCount(items.length, shown, mode));

/** What "show more" asks for: the values now shown plus one more step. */
export const showMoreTarget = (visible: number): number => visible + SHOW_MORE_STEP;

/** The set with `uri` removed if it was in it, added if it was not. */
export const toggled = (set: ReadonlySet<string>, uri: string): ReadonlySet<string> => {
  const next = new Set(set);
  if (!next.delete(uri)) next.add(uri);
  return next;
};
