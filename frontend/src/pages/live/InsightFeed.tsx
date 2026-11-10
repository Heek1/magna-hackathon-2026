import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import type { Insight, Severity } from "@/types/api";
import { useActions, useInsights } from "@/api/hooks";
import { InsightCard } from "@/components/InsightCard";
import { Panel } from "@/components/Panel";

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Predictions pinned on top (soonest first), then by severity, then by loss. */
export function sortInsights(list: Insight[]): { pinned: Insight[]; rest: Insight[] } {
  const pinned = list
    .filter((i) => i.kind === "prediction" && i.expected_at)
    .sort((a, b) => a.expected_at!.localeCompare(b.expected_at!));
  const rest = list
    .filter((i) => !pinned.includes(i))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.loss_pcs - a.loss_pcs);
  return { pinned, rest };
}

export function InsightFeed({ className }: { className?: string }) {
  const insights = useInsights();
  const actions = useActions();
  const { pinned, rest } = useMemo(() => sortInsights(insights.data ?? []), [insights.data]);
  const created = useMemo(() => new Set((actions.data ?? []).map((a) => a.insight_id)), [actions.data]);
  const count = (insights.data ?? []).length;

  const state = insights.error ? "error" : insights.loading ? "loading" : count === 0 ? "empty" : "ready";

  return (
    <Panel
      title="Insights"
      meta={count > 0 ? `${count} open` : undefined}
      state={state}
      emptyText="No findings yet — the engine is watching"
      errorText={insights.error}
      className={className}
      bodyClassName="flex flex-col gap-3 overflow-y-auto p-3"
    >
      <AnimatePresence initial={false}>
        {pinned.map((i) => (
          <InsightCard
            key={i.id}
            insight={i}
            pinned
            actionCreated={created.has(i.id)}
            onCreateAction={actions.createAction}
          />
        ))}
        {rest.map((i) => (
          <InsightCard key={i.id} insight={i} actionCreated={created.has(i.id)} onCreateAction={actions.createAction} />
        ))}
      </AnimatePresence>
    </Panel>
  );
}
