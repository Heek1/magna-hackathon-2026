import { motion } from "framer-motion";
import { Check, Clock, Gauge, Repeat, ShieldAlert, Sparkles, Plus, type LucideIcon } from "lucide-react";
import type { Insight, InsightKind } from "@/types/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
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

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: tokens.enter, ease: tokens.ease }}
      className={cn(
        "flex flex-col gap-3 rounded border bg-surface p-4",
        pinned && "border-border-strong bg-surface-2",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <KindIcon className="h-4 w-4 text-muted" aria-hidden />
        <span className="label">{kindLabel}</span>
        {insight.code && <span className="num text-xs text-dim">{insight.code}</span>}
        <StatusBadge status={severityStatus[insight.severity]} className="ml-auto">
          {severityLabel[insight.severity]}
        </StatusBadge>
      </header>

      {pinned && expected && (
        <div className="flex items-end justify-between rounded border bg-bg px-3 py-2">
          <div className="flex flex-col">
            <span className="label">Expected in</span>
            <Countdown to={insight.expected_at!} className="text-num-lg font-medium text-text" />
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
        <p className="text-sm leading-snug text-muted">{insight.evidence}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-y py-2">
        <Metric label="Loss" value={`${pcs(insight.loss_pcs)}`} unit="pcs" />
        <Metric label="OEE impact" value={insight.loss_pp.toFixed(2)} unit="pp" />
        {rec && <Metric label="Gain" value={`+${pcs(rec.expected_gain_pcs)}`} unit="pcs" tone="text-ok" />}
      </dl>

      {rec && (
        <div className="flex flex-col gap-1.5">
          <span className="label">Countermeasure</span>
          <p className="text-sm leading-snug text-text/90">{rec.action}</p>
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
          <Button variant="action" onClick={() => onCreateAction(insight)}>
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
