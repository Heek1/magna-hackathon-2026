import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Gauge, Repeat, ShieldAlert, Sparkles, Plus, type LucideIcon } from "lucide-react";
import type { Insight, InsightKind } from "@/types/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { useSimClock } from "@/api/hooks";
import { cn } from "@/lib/utils";
import { dayLabel, hhmm, parseTime, pcs } from "@/lib/format";
import { severityLabel, severityStatus } from "@/lib/status";
import { motion as tokens } from "@/theme/tokens";

const kindMeta: Record<InsightKind, { icon: LucideIcon; label: string }> = {
  prediction: { icon: Clock, label: "Prediction" },
  recurring_stop: { icon: Repeat, label: "Recurring stop" },
  slow_hour: { icon: Gauge, label: "Slow hour" },
  quality: { icon: ShieldAlert, label: "Quality" },
  anomaly: { icon: Sparkles, label: "Anomaly" },
};

export interface InsightCardProps {
  insight: Insight;
  /** Pinned cards (prediction) show a big countdown to expected_at. */
  pinned?: boolean;
  /** Hide the button when not needed (e.g. read-only report). */
  onCreateAction?: (insight: Insight) => void;
  /** An action already exists for this insight. */
  actionCreated?: boolean;
  className?: string;
}

/** One finding of the engine: what, evidence, loss, countermeasure, and the "Create action" call. */
export function InsightCard({ insight, pinned, onCreateAction, actionCreated, className }: InsightCardProps) {
  const { icon: KindIcon, label: kindLabel } = kindMeta[insight.kind];
  const rec = insight.recommendation;
  const expected = insight.expected_at ? parseTime(insight.expected_at) : null;
  const [showEvidence, setShowEvidence] = useState(false);
  const edge = { high: "bg-crit", medium: "bg-warn", low: "bg-border-strong" }[insight.severity];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: tokens.enter, ease: tokens.ease }}
      className={cn(
        "relative flex shrink-0 flex-col gap-3 overflow-hidden rounded border bg-surface py-4 pl-5 pr-4",
        pinned && "border-border-strong bg-surface-2",
        className,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", edge)} aria-hidden />
      <header className="flex items-center gap-2">
        <KindIcon className="h-4 w-4 text-muted" aria-hidden />
        <span className="label">{kindLabel}</span>
        {insight.code && <span className="num text-xs text-dim">{insight.code}</span>}
        <StatusBadge status={severityStatus[insight.severity]} className="ml-auto">
          {severityLabel[insight.severity]}
        </StatusBadge>
      </header>

      {pinned && expected && (
        <div className="flex items-end justify-between rounded border bg-bg px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <span className="label">Expected in</span>
            <PredictionCountdown to={insight.expected_at!} />
          </div>
          <span className="num text-right text-sm text-muted">
            {dayLabel(expected)}
            <br />
            {hhmm(expected)}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold leading-snug text-text">{insight.title}</h3>
        <p className={cn("text-sm leading-snug text-muted", !showEvidence && "line-clamp-2")}>{insight.evidence}</p>
        <button
          type="button"
          onClick={() => setShowEvidence((v) => !v)}
          aria-expanded={showEvidence}
          className="self-start text-xs text-dim underline-offset-2 hover:text-text hover:underline"
        >
          {showEvidence ? "Show less" : "Show evidence"}
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-y py-2">
        <Metric label="Loss" value={`${pcs(insight.loss_pcs)}`} unit="pcs" />
        <Metric label="OEE impact" value={insight.loss_pp.toFixed(2)} unit="pp" />
        {rec && <Metric label="Gain" value={`+${pcs(rec.expected_gain_pcs)}`} unit="pcs" tone="text-ok" />}
      </dl>

      {rec && (
        <div className="flex flex-col gap-1.5 border-l-2 border-data/50 pl-3">
          <span className="label">Countermeasure</span>
          <p className="text-sm leading-snug text-text">{rec.action}</p>
          <div className="flex flex-wrap gap-1.5 text-xs text-muted">
            <span className="rounded border px-1.5 py-0.5">{rec.method}</span>
            <span className="rounded border px-1.5 py-0.5">{rec.owner_role}</span>
          </div>
        </div>
      )}

      {onCreateAction &&
        (actionCreated ? (
          <div className="flex h-9 items-center justify-center gap-2 rounded border border-ok/40 text-sm text-ok">
            <Check className="h-4 w-4" /> Action created
          </div>
        ) : (
          <Button variant={insight.severity === "high" ? "action" : "default"} onClick={() => onCreateAction(insight)}>
            <Plus className="h-4 w-4" /> Create action
          </Button>
        ))}
    </motion.article>
  );
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label">{label}</dt>
      <dd className={cn("num text-lg font-medium text-text", tone)}>
        {value}
        <span className="ml-1 text-xs text-muted">{unit}</span>
      </dd>
    </div>
  );
}

/** Countdown that turns red in the last 30 minutes — then it needs action now. */
function PredictionCountdown({ to }: { to: string }) {
  const { now } = useSimClock();
  const urgent = parseTime(to).getTime() - now.getTime() < 30 * 60 * 1000;
  return <Countdown to={to} className={cn("text-num-lg font-medium leading-none", urgent ? "text-accent" : "text-text")} />;
}
