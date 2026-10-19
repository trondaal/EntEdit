/**
 * Pure helpers for the interaction log (types/logging.ts), kept out of the
 * components so they can be tested without a DOM.
 */
import type { CatalogingPreferences } from "./catalogingStyle";
import type { LogEvent, LogEventInput, SessionContext } from "../types/logging";
import type { SparqlEndpointConfig } from "../types/sparql";

/** The event as stored: the caller's fields plus when it happened and its place in the session. */
export const stampEvent = (
  event: LogEventInput,
  sequenceNumber: number,
  timestamp: string,
): LogEvent => ({ ...event, timestamp, sequenceNumber }) as LogEvent;

/** The header that lets a reader interpret the log: build and setup, no credentials or addresses. */
export const buildSessionContext = (
  appVersion: string,
  preferences: CatalogingPreferences,
): SessionContext => ({ appVersion, preferences: { ...preferences } });

export interface SettingChange {
  setting: string;
  value: string | boolean;
}

/** The preferences that differ, each with its new value. */
export const diffPreferences = (
  before: CatalogingPreferences,
  after: CatalogingPreferences,
): SettingChange[] =>
  (Object.keys(after) as Array<keyof CatalogingPreferences>)
    .filter((key) => before[key] !== after[key])
    .map((key) => ({ setting: key, value: after[key] }));

/**
 * The endpoint settings that differ. Addresses are not recorded (they can name a
 * private server) and credentials never are: the log only says that one changed.
 */
export const diffEndpoint = (
  before: SparqlEndpointConfig,
  after: SparqlEndpointConfig,
): SettingChange[] => {
  const changes: SettingChange[] = [];
  if (before.url !== after.url) changes.push({ setting: "endpoint", value: "changed" });
  if ((before.dataGraph ?? "") !== (after.dataGraph ?? "")) {
    changes.push({ setting: "dataGraph", value: "changed" });
  }
  return changes;
};

/**
 * Following a link puts its label in the search box, which the search then runs as
 * a query of its own; that search is already recorded as the followed link. The
 * guard remembers the label so the query that comes from it is not counted twice
 * as a search the user typed.
 */
export interface LinkSearchGuard {
  /** A link was followed and its label became the search text. */
  mark: (label: string) => void;
  /** The search text settled on `query`: true once if it is the followed link's label. */
  consume: (query: string) => boolean;
}

export const createLinkSearchGuard = (): LinkSearchGuard => {
  let pending: string | null = null;
  return {
    mark: (label) => {
      pending = label;
    },
    consume: (query) => {
      const fromLink = pending !== null && pending === query;
      pending = null;
      return fromLink;
    },
  };
};
