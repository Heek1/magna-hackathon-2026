import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Presentation, SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SPEEDS, useSimClock, useSimControl, useSimState } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { dayLabel, hhmmss, toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion as tokens } from "@/theme/tokens";

/**
 * Simulator controls (pause, speed, jump to date and time) in a bottom sheet, off the main screen.
 * Renders its own trigger button.
 */
export function SimSettings({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={withLabel ? "ghost" : "surface"}
        size={withLabel ? "md" : "icon"}
        className={cn(withLabel && "justify-start px-3", className)}
        onClick={() => setOpen(true)}
        aria-label="Simulation settings"
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
        {withLabel && "Simulation"}
      </Button>
      <AnimatePresence>{open && <Sheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const { now, speed, paused } = useSimClock();
  const { data } = useSimState();
  const { setPaused, setSpeed, jumpTo, startDemo, error } = useSimControl();
  const navigate = useNavigate();
  const [target, setTarget] = useState(() => toLocalInput(now));
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const jump = (e: FormEvent) => {
    e.preventDefault();
    const d = new Date(target);
    if (!Number.isNaN(d.getTime())) jumpTo(d);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: tokens.enter }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-settings-title"
        tabIndex={-1}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: tokens.enter, ease: tokens.ease }}
        className="relative w-full max-w-md rounded-t-hero bg-bg-card px-gutter pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-card outline-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id="sim-settings-title" className="text-title-l">
            Simulation
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <p className="text-caption text-text-secondary">
          Replays the line data at speed. Every screen shows data up to this moment.
        </p>

        <button
          type="button"
          onClick={() => {
            startDemo();
            navigate("/");
            onClose();
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-card bg-bg-ink p-card-pad text-left text-white transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-badge bg-white/10">
            <Presentation className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">Start demo</span>
            <span className="block text-caption text-white/60">Wed 25 Nov 08:50 · 60× · camera stop at 09:08</span>
          </span>
          <Play className="h-5 w-5 shrink-0" aria-hidden />
        </button>

        <div className="mt-4 flex items-center justify-between rounded-card bg-bg-subtle p-card-pad">
          <div>
            <span className="overline-label">Sim time</span>
            <p className="num text-num-l text-text-primary">{data ? hhmmss(now) : "--:--:--"}</p>
            <p className="text-caption text-text-secondary">{data ? dayLabel(now) : "Waiting for the backend"}</p>
          </div>
          <Button variant="primary" size="icon" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? <Play className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
          </Button>
        </div>

        <div className="mt-4">
          <span className="overline-label">Speed</span>
          <SegmentedControl
            className="mt-2"
            label="Simulation speed"
            value={String(speed)}
            onChange={(v) => setSpeed(Number(v))}
            options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
          />
        </div>

        <form onSubmit={jump} className="mt-4">
          <label htmlFor="sim-jump" className="overline-label">
            Jump to
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="sim-jump"
              type="datetime-local"
              value={target}
              min="2026-11-02T06:00"
              max="2026-11-30T14:00"
              onChange={(e) => setTarget(e.target.value)}
              className="num h-11 min-w-0 flex-1 rounded-button border bg-bg-card px-3 text-body"
            />
            <Button type="submit" variant="primary" disabled={!target}>
              Jump
            </Button>
          </div>
        </form>

        {error && <p className="mt-3 text-caption text-status-stop">{error}</p>}
      </motion.div>
    </div>
  );
}
