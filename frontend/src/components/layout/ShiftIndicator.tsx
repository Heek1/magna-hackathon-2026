import { useSimClock } from "@/api/hooks";
import { cn } from "@/lib/utils";

const SHIFT_START = 6;
const SHIFT_HOURS = 8;

/** Shift 06:00–14:00: which hour is running, as 8 segments. */
export function ShiftIndicator() {
  const { now } = useSimClock();
  const h = now.getHours() + now.getMinutes() / 60;
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const inShift = !weekend && h >= SHIFT_START && h < SHIFT_START + SHIFT_HOURS;
  const current = inShift ? Math.floor(h - SHIFT_START) + 1 : 0;
  const done = !weekend && h >= SHIFT_START + SHIFT_HOURS;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="label">Shift 06–14</span>
        <span className={cn("label", inShift ? "text-text" : "text-dim")}>
          {inShift ? (
            <>
              Hour <span className="num">{current}</span>/8
            </>
          ) : done ? (
            "Ended"
          ) : (
            "Off shift"
          )}
        </span>
      </div>
      <div className="flex gap-0.5" aria-hidden>
        {Array.from({ length: SHIFT_HOURS }, (_, i) => {
          const n = i + 1;
          const state = done || n < current ? "done" : n === current ? "now" : "todo";
          return (
            <span
              key={n}
              className={cn(
                "h-1.5 w-5",
                state === "done" && "bg-data",
                state === "now" && "bg-text",
                state === "todo" && "bg-border-strong",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
