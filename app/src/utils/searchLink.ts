/**
 * A link followed from a search result: a creator's name or a relationship
 * target. The label goes into the search field; the URI and kind let the
 * content search show the target itself first instead of relying on how the
 * label's words rank (related entities repeat them in their index entries).
 */

/** What a followed link points to. */
export type LinkKind = "expression" | "work" | "agent";

export interface LinkTarget {
  /** Label shown in the search field and searched as text */
  label: string;
  uri?: string;
  kind: LinkKind;
}

/** Called when a name or title in a search result is clicked. */
export type EntitySearchHandler = (label: string, target?: Omit<LinkTarget, "label">) => void;

/**
 * Lucene query for an agent's name as a phrase in the names field only:
 * works *by* the agent, not works that merely mention the name in a title.
 * Inside quotes only " and \ are special.
 */
export const toNameQuery = (name: string): string =>
  `+names:"${name.trim().replace(/[\\"]/g, (c) => `\\${c}`)}"`;
