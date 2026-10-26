import { createContext, useContext } from "react";
import { DEFAULT_PART_LEVELS, type PartLevels } from "../utils/partRelations";
import type { ResultColors } from "../utils/resultColors";

/**
 * Display preferences the search results read: provided by `App` from the
 * user's preferences, so the result components need no props for them.
 */
export interface ResultDisplay {
  /** Which level's "is part of" / "has part" lines to show */
  partLevels: PartLevels;
  /** How the nested parts of a result are coloured (`?colors=type` selects the earlier scheme) */
  colors: ResultColors;
}

export const ResultDisplayContext = createContext<ResultDisplay>({
  partLevels: DEFAULT_PART_LEVELS,
  colors: "level",
});

export const useResultDisplay = (): ResultDisplay => useContext(ResultDisplayContext);
