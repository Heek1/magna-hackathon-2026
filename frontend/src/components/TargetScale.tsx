import { motion, useReducedMotion } from "framer-motion";
import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { motion as tokens } from "@/theme/tokens";

export interface TargetScaleProps {
  /** Fraction 0..1. */
  value: number;
  /** Fraction 0..1 — drawn as a tick across the track. */
  target?: number;
  /** Visible range of the ruler; zoomed so a few pp are visible from across the room. */
  range?: [number, number];
  status: Status;
  size?: "md" | "lg";
  className?: string;
}

const fill: Record<Status, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  neutral: "bg-data",
};

/**
 * Instrument ruler: value as a filled track on a zoomed scale, target as a tick, graduations
 * every 5 or 10 pp. Reads like a panel meter, so the gap to target is visible without reading digits.
 */
export function TargetScale({ value, target, range = [0.6, 1], status, size = "md", className }: TargetScaleProps) {
  const reduce = useReducedMotion();
  const [min, max] = range;
  const pos = (v: number) => `${Math.max(0, Math.min(1, (v - min) / (max - min))) * 100}%`;
  const step = max - min > 0.2 ? 0.1 : max - min > 0.1 ? 0.05 : 0.02;
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);

  return (
    <div className={cn("flex flex-col gap-1", className)} aria-hidden>
      <div className={cn("relative w-full bg-surface-2", size === "lg" ? "h-3" : "h-2")}>
        {ticks.slice(1, -1).map((t) => (
          <span key={t} className="absolute inset-y-0 w-px bg-bg" style={{ left: pos(t) }} />
        ))}
        <motion.div
          className={cn("absolute inset-y-0 left-0", fill[status])}
          initial={false}
          animate={{ width: pos(value) }}
          transition={reduce ? { duration: 0 } : { duration: tokens.number, ease: tokens.ease }}
        />
        {target !== undefined && (
          <span className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 bg-text" style={{ left: pos(target) }} />
        )}
      </div>
      <div className="relative h-3.5">
        {ticks.map((t, i) => (
          <span
            key={t}
            className={cn(
              "num absolute text-[11px] leading-none text-dim",
              i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
            )}
            style={{ left: pos(t) }}
          >
            {Math.round(t * 100)}
          </span>
        ))}
      </div>
    </div>
  );
}
