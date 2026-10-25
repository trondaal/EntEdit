import { createContext, useContext } from "react";

/**
 * How deep in a search result a component is: 0 for the result at the top of a tab, and one more
 * for each opened list it sits in. Read by the cards and lists to pick their shade
 * (`utils/resultColors.ts`).
 */
export const ResultLevelContext = createContext(0);

export const useResultLevel = (): number => useContext(ResultLevelContext);
