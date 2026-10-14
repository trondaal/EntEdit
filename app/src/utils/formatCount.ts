/**
 * Entity counts for the list header, which has little room: a repository can hold
 * 1,530,099 expressions, and "1,490 of 1,530,099" took more width than the filter
 * field next to it. From 100,000 the number is compact ("1.5M"), below that written in
 * full with the language's thousands separator. `formatCountExact` always writes it in
 * full, for a tooltip.
 */
const COMPACT_FROM = 100_000;

export const formatCountExact = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(value);

export const formatCount = (value: number, locale: string): string =>
  value >= COMPACT_FROM
    ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : formatCountExact(value, locale);
