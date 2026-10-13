import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toggled } from "../utils/propertyView";

/**
 * What the user has done to the display of an entity's property values:
 * collapsed properties and how many values of each were asked for. Held by
 * the editor (a new editor is mounted per entity, so it starts afresh) and
 * read by every property list and by the editor's label lookup, which
 * resolves labels only for the values on screen.
 */
export interface PropertyView {
  collapsed: ReadonlySet<string>;
  /** Values asked for per property; absent means the initial few. */
  shown: ReadonlyMap<string, number>;
  toggle: (propertyUri: string) => void;
  setShown: (propertyUri: string, count: number) => void;
  collapseAll: (propertyUris: readonly string[]) => void;
  expandAll: () => void;
}

const NONE: PropertyView = {
  collapsed: new Set(),
  shown: new Map(),
  toggle: () => {},
  setShown: () => {},
  collapseAll: () => {},
  expandAll: () => {},
};

export const PropertyViewContext = createContext<PropertyView>(NONE);

export const usePropertyView = (): PropertyView => useContext(PropertyViewContext);

/** The state itself, for the component that provides the context. */
export const usePropertyViewState = (): PropertyView => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShownMap] = useState<ReadonlyMap<string, number>>(new Map());

  const toggle = useCallback(
    (propertyUri: string) => setCollapsed((current) => toggled(current, propertyUri)),
    [],
  );
  const setShown = useCallback(
    (propertyUri: string, count: number) =>
      setShownMap((current) => new Map(current).set(propertyUri, count)),
    [],
  );
  const collapseAll = useCallback(
    (propertyUris: readonly string[]) => setCollapsed(new Set(propertyUris)),
    [],
  );
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  return useMemo(
    () => ({ collapsed, shown, toggle, setShown, collapseAll, expandAll }),
    [collapsed, shown, toggle, setShown, collapseAll, expandAll],
  );
};
