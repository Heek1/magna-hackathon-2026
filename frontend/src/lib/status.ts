import { warnBand } from "@/theme/tokens";
import type { Severity } from "@/types/api";

export type Status = "ok" | "warn" | "crit" | "neutral";

/** Higher-is-better metric vs target: at/above → ok, within warnBand below → warn, else crit. */
export function statusVsTarget(value: number, target: number, band = warnBand): Status {
  if (value >= target) return "ok";
  if (target - value <= band) return "warn";
  return "crit";
}

export const severityStatus: Record<Severity, Status> = {
  high: "crit",
  medium: "warn",
  low: "neutral",
};

export const severityLabel: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
