import { useSimClock, useSimState } from "@/api/hooks";
import { cn } from "@/lib/utils";

const SHIFT_START = 6;
const SHIFT_HOURS = 8;

/**
 * Shift 06:00–14:00 as eight hour segments with a progress fill inside the running hour.
 * While the line is stopped, the running hour turns red and pulses with the downtime banner.
 */
export function ShiftIndicator() {
  const { now } = useSimClock();
  const { data } = useSimState();
  const stopped = !!data?.active_downtime;
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const inShift = !!data && !weekend && h >= SHIFT_START && h < SHIFT_START + SHIFT_HOURS;
  const current = inShift ? Math.floor(h - SHIFT_START) + 1 : 0;
  const done = !!data && !weekend && h >= SHIFT_START + SHIFT_HOURS;
  const partial = inShift ? h - SHIFT_START - (current - 1) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label">Shift</span>
        <span className="label text-text/90">
          {inShift ? (
            <>
              Hour <span className="num">{current}</span> of 8
            </>
          ) : done ? (
            "Ended"
          ) : (
            "Off shift"
          )}
        </span>
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: SHIFT_HOURS }, (_, i) => {
          const n = i + 1;
          const isNow = n === current;
          const isDone = done || n < current;
          return (
            <span key={n} className="relative h-2 w-6 overflow-hidden bg-border-strong">
              {(isDone || isNow) && (
                <span
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isNow ? (stopped ? "animate-stop-pulse bg-accent" : "bg-text") : "bg-data",
                  )}
                  style={{ width: isNow ? `${Math.max(8, partial * 100)}%` : "100%" }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="num flex justify-between text-[11px] leading-none text-dim" aria-hidden>
        <span>06</span>
        <span>10</span>
        <span>14</span>
      </div>
    </div>
  );
}
