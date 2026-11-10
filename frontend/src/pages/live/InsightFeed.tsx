import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Insight, Severity } from "@/types/api";
import { resourceState, useActions, useInsights } from "@/api/hooks";
import { InsightCard } from "@/components/InsightCard";
import { StateView } from "@/components/Panel";
import { errorText } from "@/api/client";

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

/** Insight feed content (inside the Live right rail). */
export function InsightFeed() {
  const insights = useInsights();
  const actions = useActions();
  const [createError, setCreateError] = useState<string | null>(null);
  const { pinned, rest } = useMemo(() => sortInsights(insights.data ?? []), [insights.data]);
  const created = useMemo(() => new Set((actions.data ?? []).map((a) => a.insight_id)), [actions.data]);

  const create = (i: Insight) => {
    setCreateError(null);
    actions.createAction(i).catch((e) => setCreateError(`Could not create action: ${errorText(e)}`));
  };

  return (
    <StateView
      state={resourceState(insights)}
      emptyText="No findings yet — the engine is watching"
      errorText={insights.error}
    >
      {createError && <p className="rounded border border-crit/50 px-3 py-2 text-sm text-crit">{createError}</p>}
      <AnimatePresence initial={false}>
        {[...pinned, ...rest].map((i) => (
          <InsightCard
            key={i.id}
            insight={i}
            pinned={pinned.includes(i)}
            actionCreated={created.has(i.id)}
            onCreateAction={create}
          />
        ))}
      </AnimatePresence>
    </StateView>
  );
}
