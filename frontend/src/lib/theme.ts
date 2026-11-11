/**
 * Theme choice: Auto (the default, follows the phone, also while the app is open), Light or Dark.
 * Remembered on the phone in localStorage; index.html reads the same key before the first paint.
 */
import { useCallback, useSyncExternalStore } from "react";
import { themes, type ThemeName } from "@/theme/tokens";

export type ThemeChoice = "auto" | ThemeName;

const KEY = "oee-engine.theme";
const EVENT = "oee-engine:theme";
const SYSTEM_DARK = "(prefers-color-scheme: dark)";

let session: ThemeChoice | null = null; // the choice, when storage is blocked

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* private mode / storage blocked */
  }
  return session ?? "auto";
}

function activeTheme(): ThemeName {
  const choice = readChoice();
  if (choice !== "auto") return choice;
  return window.matchMedia(SYSTEM_DARK).matches ? "dark" : "light";
}

/** Put the theme on <html> and tell the browser, so its bars and native pickers match. */
function apply() {
  const theme = activeTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes[theme]["bg-canvas"]);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Keeps <html> in sync for the whole session, including the phone switching to dark while the app is open. */
export function startTheme() {
  apply();
  subscribe(apply);
  window.matchMedia(SYSTEM_DARK).addEventListener("change", apply);
}

/** [auto | light | dark, setChoice]. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "auto" as ThemeChoice);
  const setChoice = useCallback((next: ThemeChoice) => {
    session = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [choice, setChoice];
}
