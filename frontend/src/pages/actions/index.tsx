import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw, User } from "lucide-react";
import { useActions, useInsights, useLosses } from "@/api/hooks";
import { cn } from "@/lib/utils";
import type { Action, ActionStatus } from "@/types/api";
import { KIND_OF, type LossWithFix } from "../analysis/model";
import { Card, Chip, ScreenHeader, SegmentedControl, StateCard } from "../analysis/ui";

const COLUMNS: { value: ActionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

interface Row {
  action: Action;
  code: string | null;
  kind: "stop" | "defect" | "speed" | null;
  gainPcs: number | null;
}

/** Fixes: actions created from errors and insights, with their expected gain. */
export default function FixesPage() {
  const actions = useActions();
  const insights = useInsights();
  const losses = useLosses({});
  const [tab, setTab] = useState<ActionStatus>("open");

  const rows = useMemo<Row[]>(() => {
    const byFix = new Map<string, LossWithFix>();
    const byCode = new Map<string, LossWithFix>();
    for (const l of (losses.data ?? []) as LossWithFix[]) {
      if (l.fix) byFix.set(l.fix.action, l);
      if (!byCode.has(l.code)) byCode.set(l.code, l);
    }
    return (actions.data ?? []).map((a) => {
      const insight = a.insight_id ? insights.data?.find((i) => i.id === a.insight_id) : undefined;
      const loss = byFix.get(a.title) ?? (insight?.code ? byCode.get(insight.code) : undefined);
      const code = loss?.code ?? insight?.code ?? null;
      return {
        action: a,
        code,
        kind: loss ? KIND_OF[loss.type] : null,
        gainPcs: insight?.recommendation?.expected_gain_pcs ?? loss?.loss_pcs ?? null,
      };
    });
  }, [actions.data, insights.data, losses.data]);

  const count = (s: ActionStatus) => rows.filter((r) => r.action.status === s).length;
  const pending = rows.filter((r) => r.action.status !== "done").reduce((s, r) => s + (r.gainPcs ?? 0), 0);
  const done = rows.filter((r) => r.action.status === "done").reduce((s, r) => s + (r.gainPcs ?? 0), 0);

  const body =
    actions.data === undefined ? (
      <StateCard state={actions.error ? "error" : "loading"} error={actions.error} />
    ) : rows.length === 0 ? (
      <StateCard state="empty" empty="No fixes yet — assign one from Top errors" />
    ) : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-3.5 px-gutter pb-28 pt-2 lg:pb-8">
      <ScreenHeader overline={`${count("open") + count("in_progress")} ACTIVE · ${count("done")} DONE`} title="Fixes" />

      <Card className="flex items-center gap-4 bg-bg-ink text-white">
        <div className="flex-1">
          <p className="text-overline uppercase text-white/50">If every open fix works</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-num-l">+{Math.round(pending)}</span>
            <span className="text-caption text-white/60">pcs this month</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-overline uppercase text-white/50">Done so far</p>
          <p className="num mt-1 text-num-m text-[#34D399]">+{Math.round(done)} pcs</p>
        </div>
      </Card>

      {body ?? (
        <>
          <div className="lg:hidden">
            <SegmentedControl value={tab} onChange={setTab} options={COLUMNS.map((c) => ({ ...c, count: count(c.value) }))} />
            <div className="mt-3 space-y-3">
              <FixList rows={rows.filter((r) => r.action.status === tab)} />
            </div>
          </div>
          <div className="hidden gap-4 lg:grid lg:grid-cols-3">
            {COLUMNS.map((c) => (
              <section key={c.value} className="space-y-3">
                <h2 className="flex items-center gap-2 px-1 text-title-m">
                  {c.label} <span className="num text-num-s text-text-tertiary">{count(c.value)}</span>
                </h2>
                <FixList rows={rows.filter((r) => r.action.status === c.value)} />
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FixList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-caption text-text-tertiary">Nothing here</p>;
  return (
    <AnimatePresence initial={false}>
      {rows.map((r) => (
        <motion.div key={r.action.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}>
          <FixCard row={r} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function FixCard({ row }: { row: Row }) {
  const { updateStatus } = useActions();
  const navigate = useNavigate();
  const { action, code, kind, gainPcs } = row;
  const next: Record<ActionStatus, { to: ActionStatus; label: string; icon: typeof ArrowRight } | null> = {
    open: { to: "in_progress", label: "Start", icon: ArrowRight },
    in_progress: { to: "done", label: "Done", icon: Check },
    done: { to: "open", label: "Reopen", icon: RotateCcw },
  };
  const step = next[action.status];

  return (
    <Card className={cn("space-y-3", action.status === "done" && "opacity-75")}>
      <div className="flex items-start gap-3">
        <p className={cn("flex-1 text-body font-medium", action.status === "done" && "text-text-secondary line-through decoration-text-tertiary")}>{action.title}</p>
        {gainPcs !== null && <span className="num shrink-0 text-num-s text-status-fix">+{Math.round(gainPcs)} pcs</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {code && (
          <button onClick={() => navigate(`/analysis?code=${encodeURIComponent(code)}`)} className="contents">
            <Chip tone={kind ?? "neutral"}>{code}</Chip>
          </button>
        )}
        <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
          <User className="size-3.5" /> {action.owner ?? "Unassigned"}
        </span>
        <span className="flex-1" />
        {step && (
          <button
            onClick={() => updateStatus(action.id, step.to)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-chip px-3.5 text-caption font-medium transition active:scale-95",
              step.to === "done" ? "bg-status-fix text-white" : step.to === "open" ? "bg-bg-subtle text-text-secondary" : "bg-bg-ink text-white",
            )}
          >
            <step.icon className="size-3.5" strokeWidth={2.4} /> {step.label}
          </button>
        )}
      </div>
    </Card>
  );
}
