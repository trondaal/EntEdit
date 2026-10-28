/**
 * A link followed from a search result: a creator's name or a relationship
 * target. The label goes into the search field, and the search runs through
 * the ordinary Lucene query with one clause for the link:
 *
 * - an expression or work link is limited to that entity by its IRI field in
 *   the index (`expression`, `work`; see database/lucene_connectors/), and the
 *   label's words only rank the hits, so a work's original, whose title and
 *   author match its label, comes before its translations;
 * - an agent link searches the name as a phrase in the names field;
 * - a manifestation link has no IRI field to limit by (the indexes describe
 *   manifestations by their content), so its label is searched as typed; the
 *   label is indexed (`labels`), and the phrase boost ranks it first.
 *
 * Removing the link leaves the label as an ordinary search.
 */
import { sanitizeSparqlUri } from "./labelUtils";
import { toLuceneQuery } from "./luceneQuery";

/** What a followed link points to. */
export type LinkKind = "expression" | "work" | "agent" | "manifestation";

export interface LinkTarget {
  /** Label shown in the search field */
  label: string;
  uri?: string;
  kind: LinkKind;
}

/** Called when a name or title in a search result is clicked. */
export type EntitySearchHandler = (label: string, target?: Omit<LinkTarget, "label">) => void;

/** Text as a Lucene phrase; inside quotes only " and \ are special. */
const phrase = (text: string): string => `"${text.trim().replace(/[\\"]/g, (c) => `\\${c}`)}"`;

/**
 * Lucene query for an agent's name as a phrase in the names field only:
 * works *by* the agent, not works that merely mention the name in a title.
 */
export const toNameQuery = (name: string): string => `+names:${phrase(name)}`;

/**
 * Lucene query for following a link, or undefined when the link has nothing
 * to limit the search by (no IRI): then the label is searched as typed.
 */
export const toLinkQuery = ({ label, uri, kind }: LinkTarget): string | undefined => {
  if (kind === "agent") return toNameQuery(label);
  if (!uri || kind === "manifestation") return undefined;
  const limit = `+${kind}:${phrase(sanitizeSparqlUri(uri))}`;
  const ranking = toLuceneQuery(label, { optional: true });
  return ranking ? `${limit} ${ranking}` : limit;
};
