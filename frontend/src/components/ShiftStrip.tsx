import type { LineEvent } from "@/types/api";
import { parseTime } from "@/lib/format";
import { kindTone, toneSolid } from "@/lib/tone";
import { cn } from "@/lib/utils";

const START = 6;
const HOURS = 8;
const LABELS = [6, 8, 10, 12, 14];
const pad = (n: number) => String(n).padStart(2, "0");

/** Fraction of the 06:00–14:00 shift at a given moment, clamped to 0..1. */
function position(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  return Math.max(0, Math.min(1, (h - START) / HOURS));
}

export interface ShiftStripProps {
  events: LineEvent[];
  /** Current simulation time: the part of the shift already gone is filled. */
  now: Date;
  className?: string;
}

/**
 * The shift as one line: a mark for each error at the moment it happened. Stops are wide
 * (their real length), defects and speed losses are thin ticks.
 */
export function ShiftStrip({ events, now, className }: ShiftStripProps) {
  const pct = (f: number) => `${f * 100}%`;
  return (
    <div className={className} role="img" aria-label={`${events.length} errors across the shift, 06:00 to 14:00`}>
      <div className="relative h-3 overflow-hidden rounded-full bg-bg-subtle">
        <span className="absolute inset-y-0 left-0 bg-border" style={{ width: pct(position(now)) }} />
        {events.map((e) => {
          const left = position(parseTime(e.time));
          const width = e.kind === "stop" && e.unit === "min" ? e.value / (HOURS * 60) : 0;
          return (
            <span
              key={`${e.time}-${e.code}`}
              className={cn("absolute inset-y-0 min-w-[3px]", toneSolid[kindTone[e.kind]], e.active && "animate-stop-pulse")}
              style={{ left: pct(left), width: pct(width) }}
            />
          );
        })}
      </div>
      <div className="num mt-1 flex justify-between text-num-s text-text-tertiary">
        {LABELS.map((h) => (
          <span key={h}>{pad(h)}</span>
        ))}
      </div>
    </div>
  );
}
