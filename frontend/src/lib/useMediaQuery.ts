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
