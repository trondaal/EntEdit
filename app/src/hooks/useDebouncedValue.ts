import { useState, useEffect } from "react";

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after `delay` ms of inactivity.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds (default 300)
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
