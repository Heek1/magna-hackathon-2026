import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { pct, pctUnit, ppDelta } from "@/lib/format";
import { statusVsTarget, type Status } from "@/lib/status";

export interface KpiCardProps {
  label: string;
  /** Fraction 0..1 (percent KPIs). */
  value: number;
  /** Fraction 0..1. When given, the card shows the deviation and a status. */
  target?: number;
  /** Override computed status. */
  status?: Status;
  /** Small secondary line under the number, e.g. "138 of 170 pcs". */
  hint?: ReactNode;
  /** Emphasise (the headline KPI, e.g. OEE). */
  primary?: boolean;
  className?: string;
}

const formatPct = (n: number) => pct(n, 1);

/** Big KPI: number in mono with tabular figures, deviation from target paired with icon + text. */
export function KpiCard({ label, value, target, status, hint, primary, className }: KpiCardProps) {
  const s: Status = status ?? (target !== undefined ? statusVsTarget(value, target) : "neutral");
  const stripe = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", neutral: "bg-border-strong" }[s];

  return (
    <div className={cn("relative flex flex-col gap-3 overflow-hidden rounded border bg-surface p-5", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", stripe)} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("label", primary && "text-text/80")}>{label}</span>
        {target !== undefined && <StatusBadge status={s}>{ppDelta(value, target)}</StatusBadge>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <AnimatedNumber value={value} format={formatPct} className="num text-kpi font-medium text-text" />
        <span className="num text-num-md text-muted">%</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        {target !== undefined ? (
          <span>
            Target <span className="num text-text/80">{pctUnit(target)}</span>
          </span>
        ) : (
          <span />
        )}
        {hint && <span className="num">{hint}</span>}
      </div>
    </div>
  );
}
