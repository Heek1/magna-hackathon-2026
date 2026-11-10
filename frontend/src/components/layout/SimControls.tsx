import { useState, type FormEvent } from "react";
import { Pause, Play, CornerDownLeft } from "lucide-react";
import { SPEEDS, useSimClock, useSimControl } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pause / speed / jump to date & time. */
export function SimControls() {
  const { now, speed, paused } = useSimClock();
  const { setPaused, setSpeed, jumpTo } = useSimControl();
  const [target, setTarget] = useState<string>("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    const d = new Date(target);
    if (!Number.isNaN(d.getTime())) jumpTo(d);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        size="icon"
        variant={paused ? "selected" : "default"}
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Resume simulation" : "Pause simulation"}
        title={paused ? "Resume" : "Pause"}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>

      <div className="flex h-9 items-center rounded border border-border-strong p-0.5" role="group" aria-label="Simulation speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={cn(
              "num h-full rounded-sm px-2.5 text-xs transition-colors",
              speed === s ? "bg-surface-2 text-text" : "text-muted hover:text-text",
            )}
          >
            {s}×
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-1.5">
        <input
          type="datetime-local"
          aria-label="Jump to date and time"
          value={target}
          onFocus={() => !target && setTarget(toLocalInput(now))}
          min="2026-11-02T06:00"
          max="2026-11-30T14:00"
          onChange={(e) => setTarget(e.target.value)}
          className="num h-9 rounded border border-border-strong bg-surface px-2 text-xs text-text [color-scheme:dark]"
        />
        <Button type="submit" size="sm" className="h-9" disabled={!target}>
          <CornerDownLeft className="h-3.5 w-3.5" /> Jump
        </Button>
      </form>
    </div>
  );
}
