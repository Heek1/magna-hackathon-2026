import { useEffect, useState } from "react";

/** True while the media query matches; follows resizes and rotation. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Desktop / projector layout from 1024 px (design brief, "Desktop and projector"). */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");

/**
 * Room for three columns (Now, Top errors, Error detail): 1340 px of layout.
 * From 1600 px the UI is zoomed 1.25× (index.css), so there the same layout needs 1675 px of screen.
 */
export const useFitsThreeColumns = () =>
  useMediaQuery("(min-width: 1340px) and (max-width: 1599.98px), (min-width: 1675px)");
