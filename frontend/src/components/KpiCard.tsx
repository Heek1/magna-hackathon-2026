import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StatusBadge } from "@/components/StatusBadge";
import { TargetScale } from "@/components/TargetScale";
import { cn } from "@/lib/utils";
import { pct, pctUnit, ppDelta } from "@/lib/format";
import { statusVsTarget, type Status } from "@/lib/status";

export interface KpiCardProps {
  label: string;
  /** Fraction 0..1 (percent KPIs). */
  value: number;
  /** Fraction 0..1. When given, the card shows the deviation, a status and the target tick. */
  target?: number;
  /** Override computed status. */
  status?: Status;
  /** Visible range of the ruler, e.g. [0.9, 1] for quality. Default [0.6, 1]. */
  range?: [number, number];
  /** Secondary line under the ruler, e.g. "138 of 170 pcs". */
  hint?: ReactNode;
  /** The headline KPI (OEE): larger number and ruler. */
  primary?: boolean;
  className?: string;
}

const formatPct = (n: number) => pct(n, 1);

/** KPI as a panel meter: big tabular number, deviation (icon + text) and a ruler with the target tick. */
export function KpiCard({ label, value, target, status, range, hint, primary, className }: KpiCardProps) {
  const s: Status = status ?? (target !== undefined ? statusVsTarget(value, target) : "neutral");

  return (
    <div className={cn("flex flex-col justify-between gap-4 rounded border bg-surface p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("label", primary && "text-text")}>{label}</span>
        {target !== undefined && (
          <StatusBadge status={s} size={primary ? "md" : "sm"}>
            {ppDelta(value, target)}
          </StatusBadge>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          format={formatPct}
          className={cn("num font-medium text-text", primary ? "text-kpi-hero" : "text-kpi")}
        />
        <span className={cn("num text-muted", primary ? "text-num-lg" : "text-num-md")}>%</span>
      </div>

      <div className="flex flex-col gap-2">
        <TargetScale value={value} target={target} range={range} status={s} size={primary ? "lg" : "md"} />
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
    </div>
  );
}
