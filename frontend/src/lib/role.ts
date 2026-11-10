/**
 * Who is using the app on this phone. No accounts or passwords: the role only decides what the app
 * shows first (your fixes, your errors). Kept in localStorage, so it survives reloads.
 * In production this would come from the plant's sign-in (SSO).
 */
import { useCallback, useSyncExternalStore } from "react";
import { ClipboardCheck, Cog, PackageOpen, Users, Wrench, type LucideIcon } from "lucide-react";

/** Same names as owner_role in backend/insights/countermeasures.json. */
export type Role = "Maintenance" | "Quality" | "Logistics" | "Team leader" | "Process engineer";

export interface RoleInfo {
  role: Role;
  icon: LucideIcon;
  /** What this person looks after, in a few words. */
  blurb: string;
}

export const ROLES: RoleInfo[] = [
  { role: "Team leader", icon: Users, blurb: "The line and the shift" },
  { role: "Maintenance", icon: Wrench, blurb: "Stations, cameras and tools" },
  { role: "Quality", icon: ClipboardCheck, blurb: "Defects and scrap" },
  { role: "Process engineer", icon: Cog, blurb: "Cycle time and stability" },
  { role: "Logistics", icon: PackageOpen, blurb: "Parts and material supply" },
];

const KEY = "oee-engine.role";
const EVENT = "oee-engine:role";

function read(): Role | null {
  try {
    const v = localStorage.getItem(KEY);
    return ROLES.some((r) => r.role === v) ? (v as Role) : null;
  } catch {
    return null; // private mode / storage blocked: ask again next time
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** [role or null, setRole]. Every component using it updates together. */
export function useRole(): [Role | null, (role: Role | null) => void] {
  const role = useSyncExternalStore(subscribe, read, () => null);
  const setRole = useCallback((next: Role | null) => {
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [role, setRole];
}

export const roleInfo = (role: Role | null) => ROLES.find((r) => r.role === role) ?? null;
