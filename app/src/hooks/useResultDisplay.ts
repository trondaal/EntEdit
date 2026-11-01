import { createContext, useContext } from "react";
import type { ResultColors } from "../utils/resultColors";

/**
 * Display preferences the search results read: provided by `App` from the
 * user's preferences, so the result components need no props for them.
 */
export interface ResultDisplay {
  /** The relationship properties whose lines are left out (`utils/relationshipFilter.ts`) */
  hiddenRelationships: ReadonlySet<string>;
  /** How the nested parts of a result are coloured (`?colors=type` selects the earlier scheme) */
  colors: ResultColors;
}

export const ResultDisplayContext = createContext<ResultDisplay>({
  hiddenRelationships: new Set(),
  colors: "level",
});

export const useResultDisplay = (): ResultDisplay => useContext(ResultDisplayContext);
