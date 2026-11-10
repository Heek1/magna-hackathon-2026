/** Formatting helpers. True minus sign (U+2212) so signed numbers align in tabular figures. */

const MINUS = "−";

/** 0.8118 → "81.2" */
export function pct(fraction: number, digits = 1): string {
  return (fraction * 100).toFixed(digits);
}

/** 0.8118 → "81.2 %" */
export function pctUnit(fraction: number, digits = 1): string {
  return `${pct(fraction, digits)} %`;
}

/** Signed number with true minus: −3.8 / +1.2 */
export function signed(value: number, digits = 1): string {
  const abs = Math.abs(value).toFixed(digits);
  if (Number(abs) === 0) return abs;
  return value < 0 ? `${MINUS}${abs}` : `+${abs}`;
}

/** Percentage-point delta from fractions: (0.8118, 0.85) → "−3.8 pp" */
export function ppDelta(value: number, target: number, digits = 1): string {
  return `${signed((value - target) * 100, digits)} pp`;
}

/** Pieces, integer unless fractional data: 9.62 → "9.6", 138 → "138" */
export function pcs(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Parse a contract datetime (plant local time, no zone). */
export function parseTime(iso: string): Date {
  return new Date(iso);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "09:14" */
export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date → "09:14:32" */
export function hhmmss(d: Date): string {
  return `${hhmm(d)}:${pad(d.getSeconds())}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date → "Wed 25 Nov" */
export function dayLabel(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Duration in ms → "06:12" or "1:06:12"; days shown as "1d 02:10:00". */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const core = h > 0 || d > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${core}` : core;
}

/** Date → value for <input type="datetime-local"> */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hhmm(d)}`;
}

/** Date → contract datetime "2026-11-25T09:14:00" */
export function toIso(d: Date): string {
  return `${toLocalInput(d)}:${pad(d.getSeconds())}`;
}

/** Shift hour index (1..8) → "06:00" start label. Shift starts 06:00. */
export function hourLabel(hour: number): string {
  return `${pad(5 + hour)}:00`;
}
