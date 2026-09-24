/**
 * Converts free text typed by a user into a safe Lucene query string.
 *
 * GraphDB's Lucene connector parses `lucene:query` with the classic Lucene
 * query parser, so characters such as `(`, `"` or `:` and the operators
 * AND/OR/NOT make ordinary input fail with a parse error. Everything is
 * escaped except a trailing `*` on a word, which is kept as a prefix
 * wildcard (`countr*`).
 *
 * The result still has to go through `escapeSparqlLiteral` before it is
 * placed inside a SPARQL string literal.
 */
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;
const LUCENE_OPERATORS = new Set(["AND", "OR", "NOT"]);

export const toLuceneQuery = (input: string): string =>
  input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      // Lower-case bare operators so they are searched as words
      if (LUCENE_OPERATORS.has(word)) return word.toLowerCase();
      const wildcard = word.length > 1 && word.endsWith("*") && !word.endsWith("\\*");
      const stem = wildcard ? word.slice(0, -1) : word;
      const escaped = stem.replace(LUCENE_SPECIAL, (c) => `\\${c}`);
      return wildcard ? `${escaped}*` : escaped;
    })
    .join(" ");
