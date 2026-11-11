/**
 * Light or dark theme. Until the person picks one, the app follows the phone's system setting.
 * The choice is kept in localStorage; index.html reads the same key before the first paint.
 */
import { useCallback, useSyncExternalStore } from "react";
import { themes, type ThemeName } from "@/theme/tokens";

const KEY = "oee-engine.theme";
const EVENT = "oee-engine:theme";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

function stored(): ThemeName | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // private mode / storage blocked
  }
}

let session: ThemeName | null = null; // the choice, when storage is blocked

function read(): ThemeName {
  return stored() ?? session ?? (window.matchMedia(SYSTEM_DARK).matches ? "dark" : "light");
}

/** Put the theme on <html> and tell the browser, so its bars and native pickers match. */
function apply(theme: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes[theme]["bg-canvas"]);
}

function subscribe(onChange: () => void) {
  const system = window.matchMedia(SYSTEM_DARK);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  system.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
    system.removeEventListener("change", onChange);
  };
}

/** Keeps <html> in sync for the whole session, including a system change while the app is open. */
export function startTheme() {
  apply(read());
  subscribe(() => apply(read()));
}

/** [active theme, setTheme]. */
export function useTheme(): [ThemeName, (theme: ThemeName) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as ThemeName);
  const setTheme = useCallback((next: ThemeName) => {
    session = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [theme, setTheme];
}
