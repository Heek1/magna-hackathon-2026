/**
 * Building blocks for the Top errors, Error detail and Fixes screens, matching the Figma components
 * (Chip, RankRow, PatternGrid, SegmentedControl, BottomBar). Replace with the shared versions from
 * src/components once member 3 ships them; the props are kept the same on purpose.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, CircleAlert, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/theme/tokens";

const TONE: Record<Tone, { fg: string; bg: string; fill: string }> = {
  stop: { fg: "text-status-stop", bg: "bg-status-stop-bg", fill: "bg-status-stop" },
  defect: { fg: "text-status-defect", bg: "bg-status-defect-bg", fill: "bg-status-defect" },
  speed: { fg: "text-status-speed", bg: "bg-status-speed-bg", fill: "bg-status-speed" },
  fix: { fg: "text-status-fix", bg: "bg-status-fix-bg", fill: "bg-status-fix" },
  neutral: { fg: "text-text-secondary", bg: "bg-bg-subtle", fill: "bg-text-tertiary" },
};

export const toneFill = (t: Tone) => TONE[t].fill;
export const toneText = (t: Tone) => TONE[t].fg;
export const toneBg = (t: Tone) => TONE[t].bg;

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "block w-full rounded-card bg-bg-card p-4 text-left shadow-card",
        onClick && "transition active:scale-[0.99] hover:shadow-[0_1px_2px_rgba(16,24,40,.05),0_12px_28px_-6px_rgba(16,24,40,.12)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 text-caption font-medium", TONE[tone].bg, TONE[tone].fg, className)}>
      <span className={cn("size-1.5 rounded-full", TONE[tone].fill)} />
      {children}
    </span>
  );
}

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-overline uppercase text-text-tertiary", className)}>{children}</p>;
}

export function ScreenHeader({ overline, title, right }: { overline: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end gap-3 px-1">
      <div className="min-w-0 flex-1">
        <Overline>{overline}</Overline>
        <h1 className="mt-0.5 text-display tracking-tight text-text-primary">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="relative flex rounded-[14px] bg-[#E3E5EA] p-1" role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn("relative z-0 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-caption font-medium transition-colors", on ? "text-text-primary" : "text-text-secondary")}
          >
            {on && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 -z-10 rounded-[10px] bg-bg-card shadow-card" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
            {o.label}
            {o.count !== undefined && <span className="num text-num-s text-text-tertiary">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, tone = "stop" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
      <motion.div className={cn("h-full rounded-full", TONE[tone].fill)} initial={{ width: 0 }} animate={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }} />
    </div>
  );
}

export function RankRow({
  rank,
  title,
  meta,
  value,
  unit = "pcs lost",
  share,
  tone = "stop",
  onClick,
}: {
  rank: number;
  title: string;
  meta: string;
  value: string;
  unit?: string;
  share: number;
  tone?: Tone;
  onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} className="space-y-2.5 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="num grid size-[30px] shrink-0 place-items-center rounded-badge-sm bg-bg-subtle text-num-s text-text-secondary">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-text-primary">{title}</p>
          <p className="truncate text-caption text-text-secondary">{meta}</p>
        </div>
        <div className="text-right">
          <p className="num text-num-m text-text-primary">{value}</p>
          <p className="text-caption text-text-tertiary">{unit}</p>
        </div>
      </div>
      <ProgressBar value={share} tone={tone} />
    </Card>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13];

/** Weekday × shift hour grid; cell strength = occurrences in that slot. */
export function PatternGrid({ cells, tone = "stop" }: { cells: { weekday: string; hour: number; count: number }[]; tone?: Tone }) {
  const map = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));
  const hotDays = new Set(cells.map((c) => c.weekday));
  return (
    <div className="grid grid-cols-[34px_repeat(8,minmax(0,1fr))] gap-[5px]" role="img" aria-label="When the error happens by weekday and hour">
      <span />
      {HOURS.map((h) => (
        <span key={h} className="num text-center text-[10px] text-text-tertiary">{String(h).padStart(2, "0")}</span>
      ))}
      {DAYS.map((d) => (
        <PatternRow key={d} day={d} hot={hotDays.has(d)}>
          {HOURS.map((h) => {
            const n = map.get(`${d}-${h}`) ?? 0;
            return (
              <motion.span
                key={h}
                title={n ? `${d} ${h}:00 — ${n}×` : undefined}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (DAYS.indexOf(d) * 8 + HOURS.indexOf(h)) * 0.008 }}
                className={cn("h-[22px] rounded-[7px]", n ? TONE[tone].fill : "bg-bg-subtle", n === max && n > 0 && "shadow-[0_4px_10px_-2px_rgba(229,36,59,.45)]")}
                style={n ? { opacity: 0.35 + 0.65 * (n / max) } : undefined}
              />
            );
          })}
        </PatternRow>
      ))}
    </div>
  );
}

function PatternRow({ day, hot, children }: { day: string; hot: boolean; children: ReactNode }) {
  return (
    <>
      <span className={cn("self-center text-caption", hot ? "font-medium text-text-primary" : "text-text-tertiary")}>{day}</span>
      {children}
    </>
  );
}

export function StatCard({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: Tone }) {
  return (
    <Card className="flex-1 px-3.5 py-3.5">
      <Overline>{label}</Overline>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={cn("num text-num-l", tone ? TONE[tone].fg : "text-text-primary")}>{value}</span>
        {unit && <span className="text-caption text-text-secondary">{unit}</span>}
      </p>
    </Card>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="grid size-10 place-items-center rounded-full bg-bg-card shadow-card transition active:scale-95">
      {children ?? <ChevronLeft className="size-5" strokeWidth={2.2} />}
    </button>
  );
}

export function PrimaryButton({ children, onClick, busy, className }: { children: ReactNode; onClick: () => void; busy?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn("flex h-[52px] w-full items-center justify-center gap-2 rounded-button bg-bg-ink text-body font-medium text-white shadow-[0_10px_20px_-6px_rgba(10,13,18,.35)] transition active:scale-[0.99] disabled:opacity-70", className)}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Loading / error / empty placeholder in the screen style. */
export function StateCard({ state, error, onRetry, empty = "Nothing here yet" }: { state: "loading" | "error" | "empty"; error?: string | null; onRetry?: () => void; empty?: string }) {
  if (state === "loading")
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-card bg-bg-card/70 shadow-card" />
        ))}
      </div>
    );
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      {state === "error" && <CircleAlert className="size-6 text-status-stop" />}
      <p className="text-body font-medium">{state === "error" ? "Could not load data" : empty}</p>
      {state === "error" && error && <p className="max-w-[260px] text-caption text-text-secondary">{error}</p>}
      {state === "error" && onRetry && (
        <button onClick={onRetry} className="mt-1 inline-flex items-center gap-1.5 text-caption font-medium text-status-speed">
          <RotateCw className="size-3.5" /> Try again
        </button>
      )}
    </Card>
  );
}
