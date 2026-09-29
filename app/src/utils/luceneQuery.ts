/**
 * Converts free text typed by a user into a safe Lucene query string.
 *
 * GraphDB's Lucene connector parses `lucene:query` with the classic Lucene
 * query parser, so characters such as `(`, `"` or `:` and the operators
 * AND/OR/NOT make ordinary input fail with a parse error. Everything is
 * escaped except a trailing `*` on a word, which is kept as a prefix
 * wildcard (`countr*`).
 *
 * Every word is required (`+word`): the parser's default is OR, which made
 * each extra word *widen* the result — "vermillion sands" returned every
 * title containing "sands".
 *
 * With `fuzzy`, words also match spellings a letter or two away
 * (`vermillion` → "Vermilion"). This is the fallback for a search without
 * exact hits. Fuzzy terms are limited to the name, title and label fields:
 * the category fields hold type labels in ~30 languages, so e.g. `sands~1`
 * matches French "sans médiation" on nearly every entity.
 *
 * Words without a letter or digit ("/", "–" in a label such as "Title / Author.
 * – English") are left out: required, they matched nothing — the unanalyzed
 * filter fields keep "/" as a value no entity has — and emptied the result.
 *
 * The result still has to go through `escapeSparqlLiteral` before it is
 * placed inside a SPARQL string literal.
 */
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;
const LUCENE_OPERATORS = new Set(["AND", "OR", "NOT"]);

/** Connector fields searched by fuzzy terms (`names$work` etc. are merged into `names`). */
const FUZZY_FIELDS = ["names", "titles", "labels"];

/**
 * Edits allowed for a word of this length, as in Elasticsearch's AUTO:
 * none for short words (which would match almost anything), one up to five
 * letters, two from six.
 */
const fuzziness = (word: string): number => {
  const length = [...word].length;
  if (length <= 3) return 0;
  return length <= 5 ? 1 : 2;
};

export interface LuceneQueryOptions {
  fuzzy?: boolean;
}

/** Extra weight for an entity whose name, title or label holds the whole search as a phrase. */
const PHRASE_BOOST = 10;

export const toLuceneQuery = (input: string, { fuzzy = false }: LuceneQueryOptions = {}): string => {
  const words = input
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  const required = words
    .map((word) => {
      // Lower-case bare operators so they are searched as words
      if (LUCENE_OPERATORS.has(word)) return `+${word.toLowerCase()}`;
      const wildcard = word.length > 1 && word.endsWith("*") && !word.endsWith("\\*");
      const stem = wildcard ? word.slice(0, -1) : word;
      const escaped = stem.replace(LUCENE_SPECIAL, (c) => `\\${c}`);
      if (wildcard) return `+${escaped}*`;
      const edits = fuzzy ? fuzziness(stem) : 0;
      if (edits === 0) return `+${escaped}`;
      return `+(${FUZZY_FIELDS.map((field) => `${field}:${escaped}~${edits}`).join(" ")})`;
    })
    .join(" ");
  if (words.length < 2) return required;
  // Optional: every word is still required, but the entity labelled with the
  // whole text (a clicked relationship target, a full title) ranks first,
  // rather than the entities that merely mention it. Inside quotes only " and
  // \ are special.
  const phrase = `"${words.join(" ").replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  return `${required} (${FUZZY_FIELDS.map((field) => `${field}:${phrase}`).join(" ")})^${PHRASE_BOOST}`;
};

/** Whether the fuzzy query differs from the exact one, i.e. a fallback can find more. */
export const hasFuzzyTerms = (input: string): boolean =>
  toLuceneQuery(input, { fuzzy: true }) !== toLuceneQuery(input);
