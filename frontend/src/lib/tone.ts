import type { EventKind, LossType } from "@/types/api";
import type { Tone } from "@/theme/tokens";

export type { Tone };

/** Tailwind classes per tone — one place, so every component colors meaning the same way. */
export const toneText: Record<Tone, string> = {
  stop: "text-status-stop",
  defect: "text-status-defect",
  speed: "text-status-speed",
  fix: "text-status-fix",
  neutral: "text-text-secondary",
};
export const toneBg: Record<Tone, string> = {
  stop: "bg-status-stop-bg",
  defect: "bg-status-defect-bg",
  speed: "bg-status-speed-bg",
  fix: "bg-status-fix-bg",
  neutral: "bg-bg-subtle",
};
export const toneSolid: Record<Tone, string> = {
  stop: "bg-status-stop",
  defect: "bg-status-defect",
  speed: "bg-status-speed",
  fix: "bg-status-fix",
  neutral: "bg-text-tertiary",
};
export const toneBorder: Record<Tone, string> = {
  stop: "border-status-stop/40",
  defect: "border-status-defect/40",
  speed: "border-status-speed/40",
  fix: "border-status-fix/40",
  neutral: "border-border",
};

/** Event kind (/api/events, /api/errors) → tone. */
export const kindTone: Record<EventKind, Tone> = { stop: "stop", defect: "defect", speed: "speed" };

/** Loss type (/api/losses) → tone. */
export const lossTone: Record<LossType, Tone> = {
  downtime: "stop",
  nok: "defect",
  microstop: "speed",
  retest: "speed",
  slowdown: "speed",
};
