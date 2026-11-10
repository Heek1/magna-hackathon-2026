import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw, User } from "lucide-react";
import type { Action, ActionStatus, EventKind } from "@/types/api";
import { useActions, useInsights, useLosses, useSimState } from "@/api/hooks";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role";
import { KIND_OF } from "../analysis/model";
import { ScreenHeader, StateCard } from "../analysis/ui";

const COLUMNS: { value: ActionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

interface Row {
  action: Action;
  code: string | null;
  kind: EventKind | null;
  gainPcs: number | null;
}

/** Fixes (/fixes) — actions created from errors and insights, with their expected gain. */
export default function FixesPage() {
  const actions = useActions();
  const insights = useInsights();
  const sim = useSimState();
  const losses = useLosses(sim.data ? { to: sim.data.shift.date } : null);
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<ActionStatus>("open");
  const [role] = useRole();
  const [scope, setScope] = useState<"mine" | "all">("mine");

  const rows = useMemo<Row[]>(() => {
    const byFix = new Map<string, NonNullable<typeof losses.data>[number]>();
    const byCode = new Map<string, NonNullable<typeof losses.data>[number]>();
    for (const l of losses.data ?? []) {
      if (l.fix) byFix.set(l.fix.action, l);
      if (!byCode.has(l.code)) byCode.set(l.code, l);
    }
    return (actions.data ?? []).map((a) => {
      const insight = a.insight_id ? insights.data?.find((i) => i.id === a.insight_id) : undefined;
      const loss = byFix.get(a.title) ?? (insight?.code ? byCode.get(insight.code) : undefined);
      return {
        action: a,
        code: loss?.code ?? insight?.code ?? null,
        kind: loss ? KIND_OF[loss.type] : null,
        gainPcs: insight?.recommendation?.expected_gain_pcs ?? loss?.loss_pcs ?? null,
      };
    });
  }, [actions.data, insights.data, losses.data]);

  const mineCount = rows.filter((r) => r.action.owner === role).length;
  const shown = scope === "mine" && role ? rows.filter((r) => r.action.owner === role) : rows;
  const count = (s: ActionStatus) => shown.filter((r) => r.action.status === s).length;
  const sum = (done: boolean) => shown.filter((r) => (r.action.status === "done") === done).reduce((s, r) => s + (r.gainPcs ?? 0), 0);

  return (
    <div className="flex flex-col gap-3.5 pb-4">
      <ScreenHeader
        eyebrow={`${count("open") + count("in_progress")} ACTIVE · ${count("done")} DONE`}
        title="Fixes"
        right={
          role ? (
            <div className="mb-1 flex rounded-chip bg-[#E3E5EA] p-0.5" role="tablist" aria-label="Whose fixes">
              {(["mine", "all"] as const).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={scope === s}
                  onClick={() => setScope(s)}
                  className={cn(
                    "h-8 rounded-chip px-3 text-caption font-medium transition",
                    scope === s ? "bg-bg-card text-text-primary shadow-card" : "text-text-secondary",
                  )}
                >
                  {s === "mine" ? `Mine ${mineCount}` : `All ${rows.length}`}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      <Card className="flex items-center gap-4 !bg-bg-ink text-white">
        <div className="flex-1">
          <p className="text-overline uppercase text-white/50">If every open fix works</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-num-l">+{Math.round(sum(false))}</span>
            <span className="text-caption text-white/60">pcs this month</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-overline uppercase text-white/50">Done so far</p>
          <p className="num mt-1 text-num-m text-[#34D399]">+{Math.round(sum(true))} pcs</p>
        </div>
      </Card>

      {actions.data === undefined ? (
        <StateCard state={actions.error ? "error" : "loading"} error={actions.error} />
      ) : shown.length === 0 ? (
        <StateCard
          state="empty"
          empty={scope === "mine" && role && rows.length ? `Nothing assigned to ${role} yet` : "No fixes yet — assign one from Top errors"}
        />
      ) : desktop ? (
        <div className="grid grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <section key={c.value} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 px-1 text-title-m">
                {c.label} <span className="num text-num-s text-text-tertiary">{count(c.value)}</span>
              </h2>
              <FixList rows={shown.filter((r) => r.action.status === c.value)} />
            </section>
          ))}
        </div>
      ) : (
        <>
          <SegmentedControl label="Status" value={tab} onChange={setTab} options={COLUMNS.map((c) => ({ value: c.value, label: `${c.label} ${count(c.value)}` }))} />
          <div className="flex flex-col gap-3">
            <FixList rows={shown.filter((r) => r.action.status === tab)} />
          </div>
        </>
      )}
    </div>
  );
}

function FixList({ rows }: { rows: Row[] }) {
  if (rows.length === 0)
    return <p className="rounded-card border border-dashed px-4 py-6 text-center text-caption text-text-tertiary">Nothing here</p>;
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

const NEXT: Record<ActionStatus, { to: ActionStatus; label: string; icon: typeof ArrowRight }> = {
  open: { to: "in_progress", label: "Start", icon: ArrowRight },
  in_progress: { to: "done", label: "Done", icon: Check },
  done: { to: "open", label: "Reopen", icon: RotateCcw },
};

function FixCard({ row }: { row: Row }) {
  const { updateStatus } = useActions();
  const navigate = useNavigate();
  const { action, code, kind, gainPcs } = row;
  const step = NEXT[action.status];
  const done = action.status === "done";

  return (
    <Card className={cn("flex flex-col gap-3", done && "opacity-75")}>
      <div className="flex items-start gap-3">
        <p className={cn("flex-1 text-body font-medium", done && "text-text-secondary line-through decoration-text-tertiary")}>{action.title}</p>
        {gainPcs !== null && <span className="num shrink-0 text-num-s text-status-fix">+{Math.round(gainPcs)} pcs</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {code && (
          <button onClick={() => navigate(`/errors/${encodeURIComponent(code)}`)} aria-label={`Open ${code}`}>
            <Chip tone={kind ?? "neutral"}>{code}</Chip>
          </button>
        )}
        <span className="inline-flex items-center gap-1 text-caption text-text-secondary">
          <User className="size-3.5" aria-hidden /> {action.owner ?? "Unassigned"}
        </span>
        <span className="flex-1" />
        <button
          onClick={() => updateStatus(action.id, step.to)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-chip px-3.5 text-caption font-medium transition active:scale-95",
            step.to === "done" ? "bg-status-fix text-white" : step.to === "open" ? "bg-bg-subtle text-text-secondary" : "bg-bg-ink text-white",
          )}
        >
          <step.icon className="size-3.5" strokeWidth={2.4} aria-hidden /> {step.label}
        </button>
      </div>
    </Card>
  );
}
