/** Helpers for the Top errors, Error detail and Fixes screens (data comes from the shared hooks). */
import type { ErrorDetail, EventKind, LossType } from "@/types/api";

export const KIND_OF: Record<LossType, EventKind> = {
  downtime: "stop",
  nok: "defect",
  microstop: "speed",
  retest: "speed",
  slowdown: "speed",
};

export const KIND_LABEL: Record<EventKind, string> = { stop: "Stop", defect: "Defect", speed: "Speed" };

/** Station names in the data are Slovak; the UI is English. */
const DEVICE_EN: Record<string, string> = { Kamera: "Camera", Nastroj: "Tool", Zasobovanie: "Part supply" };
export const deviceName = (d: string | null) => (d ? DEVICE_EN[d] ?? d : null);

/** "ST-038 · Camera" for stops, "Q-031 · Product circuit…" for defects, the description for speed losses. */
export function errorName(l: { code: string; device: string | null; description: string; type?: LossType }): string {
  if (l.type && KIND_OF[l.type] === "speed") return l.description;
  return l.device ? `${l.code} · ${deviceName(l.device)}` : `${l.code} · ${l.description}`;
}

const WEEKDAY_LONG: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
const hm = (iso: string) => iso.slice(11, 16);

/** Short pattern text: "Every Wed 09:08", "Mostly 08:00–09:00", or null when there is no pattern. */
export function patternLabel(d: ErrorDetail, long = false): string | null {
  if (d.pattern.length === 1 && d.count >= 2) {
    const day = d.pattern[0].weekday;
    return `Every ${long ? WEEKDAY_LONG[day] : day} ${hm(d.occurrences[0].start)}`;
  }
  if (d.count < 3) return null;
  const byHour = new Map<number, number>();
  for (const p of d.pattern) byHour.set(p.hour, (byHour.get(p.hour) ?? 0) + p.count);
  const [hour, n] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n / d.count < 0.4) return null;
  return `Mostly ${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00`;
}

/** "Every Wednesday 09:08 · next on 2 Dec" */
export function patternNote(d: ErrorDetail): string | null {
  const label = patternLabel(d, true);
  if (!label) return null;
  if (!d.next_expected) return label;
  const next = new Date(d.next_expected).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${label} · next on ${next}`;
}

/** Steps of a countermeasure: one per sentence or "; " clause; a single sentence stays one step. */
export function fixSteps(action: string): string[] {
  const parts = action.split(/;\s+|\.\s+(?=[A-Z])/).map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
  return parts.length ? parts.map((x) => x.charAt(0).toUpperCase() + x.slice(1)) : [action];
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
