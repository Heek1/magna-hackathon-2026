import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import type { LossType } from "@/types/api";
import { resourceState, useInsights, useLosses, useSimState, useWhatIf } from "@/api/hooks";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StateView } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { pct, pcs, signed } from "@/lib/format";
import { colors, motion as tokens } from "@/theme/tokens";

type PeriodKey = "today" | "month";

interface Cause {
  key: string; // code or key accepted by POST /api/whatif
  group: string;
  label: string;
  detail: string;
  loss_pcs: number;
}

const groupOf: Record<LossType, string> = {
  downtime: "Downtime",
  microstop: "Speed",
  retest: "Speed",
  slowdown: "Speed",
  nok: "Scrap",
};
const GROUP_ORDER = ["Downtime", "Speed", "Slow hours", "Scrap"];

const formatPct = (n: number) => pct(n, 1);

/**
 * "What if": pick causes of loss → POST /api/whatif → OEE before vs after, animated.
 * The period is today or month to date (up to sim_time).
 */
export function WhatIfPanel({ initial = [] }: { initial?: string[] }) {
  const { data: state } = useSimState();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [selected, setSelected] = useState<string[]>(initial);

  const today = state?.shift.date;
  const range = today ? { from: period === "today" ? today : `${today.slice(0, 8)}01`, to: today } : null;
  const losses = useLosses(range);
  const insights = useInsights();
  const target = state?.shift.target ?? 0.85;

  const causes = useMemo<Cause[]>(() => {
    const list: Cause[] = (losses.data ?? [])
      .filter((l) => l.loss_pcs > 0)
      .map((l) => ({
        key: l.code,
        group: groupOf[l.type],
        label: l.type === "downtime" || l.type === "nok" ? l.code : l.description,
        detail: l.type === "downtime" ? `${l.device} · ${l.description}` : l.type === "nok" ? l.description : `${l.count}×`,
        loss_pcs: l.loss_pcs,
      }));
    // Slow shift hours are a cause the engine found, not a loss row.
    if (period === "month")
      for (const i of insights.data ?? [])
        if (i.kind === "slow_hour" && i.code)
          list.push({ key: i.code, group: "Slow hours", label: `Hour ${i.code.split("_").pop()}`, detail: i.title, loss_pcs: i.loss_pcs });
    return list.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.loss_pcs - a.loss_pcs);
  }, [losses.data, insights.data, period]);

  const valid = selected.filter((k) => causes.some((c) => c.key === k));
  const result = useWhatIf(range && valid.length ? { remove: valid, from: range.from, to: range.to } : null);

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="label">Period</span>
        <div className="flex h-8 items-center rounded border border-border-strong p-0.5" role="group">
          {(["today", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                "h-full rounded-sm px-2.5 text-xs",
                period === p ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {p === "today" ? "Today" : "Month to date"}
            </button>
          ))}
        </div>
        {valid.length > 0 && (
          <button type="button" className="label ml-auto hover:text-text" onClick={() => setSelected([])}>
            Clear
          </button>
        )}
      </div>

      <Comparison
        selectedCount={valid.length}
        before={result.data?.oee_before}
        after={result.data?.oee_after}
        gainPcs={result.data?.gain_pcs}
        gainPp={result.data?.gain_pp}
        target={target}
        pending={result.pending}
        error={result.error}
      />

      <div className="label">Remove causes</div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <StateView
          state={resourceState(losses)}
          emptyText="No losses in this period"
          errorText={losses.error}
        >
          <ul className="flex flex-col">
            {causes.map((c, i) => {
              const on = valid.includes(c.key);
              const newGroup = i === 0 || causes[i - 1].group !== c.group;
              return (
                <li key={c.key}>
                  {newGroup && <div className="label pb-1 pt-3 text-dim first:pt-0">{c.group}</div>}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(c.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded border px-2.5 py-2 text-left transition-colors",
                      on ? "border-data bg-surface-2" : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        on ? "border-data bg-data text-bg" : "border-border-strong",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="num block text-sm text-text">{c.label}</span>
                      <span className="block truncate text-xs text-muted">{c.detail}</span>
                    </span>
                    <span className="num text-sm text-muted">{pcs(c.loss_pcs)} pcs</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </StateView>
      </div>
    </div>
  );
}

function Comparison({
  selectedCount,
  before,
  after,
  gainPcs,
  gainPp,
  target,
  pending,
  error,
}: {
  selectedCount: number;
  before?: number;
  after?: number;
  gainPcs?: number;
  gainPp?: number;
  target: number;
  pending: boolean;
  error: string | null;
}) {
  if (selectedCount === 0)
    return (
      <div className="flex h-[148px] items-center justify-center rounded border border-dashed border-border-strong px-4 text-center text-sm text-muted">
        Select one or more causes to see the OEE without them
      </div>
    );
  if (error && before === undefined)
    return (
      <div className="flex h-[148px] items-center justify-center rounded border border-crit/50 px-4 text-center text-sm text-crit">
        {error}
      </div>
    );

  const b = before ?? 0;
  const a = after ?? b;
  // Bars on a zoomed scale so pp differences are visible: from 60 % to 100 %.
  const MIN = 0.6;
  const w = (v: number) => `${Math.max(0, Math.min(1, (v - MIN) / (1 - MIN))) * 100}%`;

  return (
    <div className={cn("flex flex-col gap-3 rounded border bg-bg p-3 transition-opacity", pending && "opacity-60")}>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="label">OEE now</span>
          <span className="num text-num-md text-muted">
            <AnimatedNumber value={b} format={formatPct} />
            <span className="ml-0.5 text-base">%</span>
          </span>
        </div>
        <ArrowRight className="mb-1.5 h-5 w-5 text-dim" aria-hidden />
        <div className="flex flex-col items-end">
          <span className="label">Without selected</span>
          <span className="num text-num-lg font-medium text-ok">
            <AnimatedNumber value={a} format={formatPct} />
            <span className="ml-0.5 text-num-md">%</span>
          </span>
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5" aria-hidden>
        <Bar width={w(b)} color={colors["data-2"]} />
        <Bar width={w(a)} color={colors.ok} />
        <span className="absolute -bottom-1 -top-1 w-px bg-text/70" style={{ left: w(target) }} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Gain <span className="num text-sm text-ok">{signed(gainPp ?? 0, 2)} pp</span>
          <span className="mx-1.5 text-dim">·</span>
          <span className="num text-sm text-ok">+{pcs(gainPcs ?? 0)} pcs</span>
        </span>
        <span>
          Target <span className="num text-text/80">{pct(target, 0)} %</span>
        </span>
      </div>
    </div>
  );
}

function Bar({ width, color }: { width: string; color: string }) {
  return (
    <div className="h-2.5 w-full bg-surface-2">
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={false}
        animate={{ width }}
        transition={{ duration: tokens.number, ease: tokens.ease }}
      />
    </div>
  );
}
