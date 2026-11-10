import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useActions, useInsights, useLosses, useSimState } from "@/api/hooks";
import { cn } from "@/lib/utils";
import ErrorDetail from "./ErrorDetail";
import { KIND_OF, errorName, patternLabel, useErrorDetail, type ErrorKind, type LossWithFix } from "./model";
import { Card, Chip, Overline, RankRow, ScreenHeader, SegmentedControl, StateCard } from "./ui";

const TABS: { value: ErrorKind; label: string }[] = [
  { value: "stop", label: "Stops" },
  { value: "defect", label: "Defects" },
  { value: "speed", label: "Speed" },
];

/** 02 Top errors: what to fix first. `?code=` opens 03 Error detail. */
export default function TopErrorsPage() {
  const [params, setParams] = useSearchParams();
  const code = params.get("code");
  const tab = (params.get("tab") as ErrorKind | null) ?? "stop";
  const losses = useLosses({});
  const sim = useSimState();

  const items = useMemo(
    () => ((losses.data ?? []) as LossWithFix[]).filter((l) => KIND_OF[l.type] === tab).sort((a, b) => b.loss_pcs - a.loss_pcs),
    [losses.data, tab],
  );
  const counts = useMemo(() => {
    const c: Record<ErrorKind, number> = { stop: 0, defect: 0, speed: 0 };
    for (const l of losses.data ?? []) c[KIND_OF[l.type]]++;
    return c;
  }, [losses.data]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v === null ? next.delete(k) : next.set(k, v);
    setParams(next, { replace: !("code" in patch) });
  };
  const open = (c: string) => set({ code: c });
  const month = sim.data ? new Date(sim.data.sim_time).toLocaleDateString("en-GB", { month: "long" }).toUpperCase() : "THIS MONTH";
  const selected = code ?? items[0]?.code ?? null;

  const list = (
    <div className="space-y-3.5">
      <ScreenHeader overline={`${month} · BY PIECES LOST`} title="Top errors" />
      <SegmentedControl value={tab} onChange={(v) => set({ tab: v })} options={TABS.map((t) => ({ ...t, count: losses.data ? counts[t.value] : undefined }))} />
      {losses.data === undefined ? (
        <StateCard state={losses.error ? "error" : "loading"} error={losses.error} />
      ) : items.length === 0 ? (
        <StateCard state="empty" empty={`No ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} so far`} />
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={tab} className="space-y-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <FixFirst item={items[0]} kind={tab} onOpen={() => open(items[0].code)} />
            {items.length > 1 && (
              <div className="flex items-center px-1 pt-1">
                <h2 className="flex-1 text-title-m">Next to fix</h2>
                <span className="text-caption font-medium text-text-tertiary">{items.length} total</span>
              </div>
            )}
            {items.slice(1, 8).map((l, i) => (
              <RankRow
                key={l.code + (l.device ?? "")}
                rank={i + 2}
                title={errorName(l)}
                meta={metaLine(l)}
                value={fmt(l.loss_pcs)}
                share={l.loss_pcs / items[0].loss_pcs}
                tone={tab}
                onClick={() => open(l.code)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-gutter pb-28 pt-2 lg:pb-8">
      {/* Phone: one screen at a time. */}
      <div className="lg:hidden">{code ? <ErrorDetail code={code} onBack={() => set({ code: null })} /> : list}</div>
      {/* Desktop / projector: list and detail side by side. */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {list}
        <div className="pt-[4.5rem]">{selected && <ErrorDetail key={selected} code={selected} embedded />}</div>
      </div>
    </div>
  );
}

function FixFirst({ item, kind, onOpen }: { item: LossWithFix; kind: ErrorKind; onOpen: () => void }) {
  const detail = useErrorDetail(item.code);
  const { createAction, data: actions } = useActions();
  const insights = useInsights();
  const [busy, setBusy] = useState(false);
  const pattern = detail.data ? patternLabel(detail.data) : null;
  const gain = detail.data?.gain_pp ?? item.loss_pp;
  const title = item.fix?.action ?? `Remove ${item.code}`;
  const assigned = !!actions?.some((a) => a.title === title && a.status !== "done");

  async function assign(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      const insight = insights.data?.find((i) => i.code === item.code);
      await createAction({ title, owner: item.fix?.owner_role ?? null, insight_id: insight?.id ?? null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card onClick={onOpen} className="space-y-3.5 p-[18px] ring-[1.5px] ring-status-stop/35">
      <div className="flex items-center gap-2">
        <span className="rounded-chip bg-status-stop px-2.5 py-1 text-overline uppercase text-white">#1 Fix first</span>
        <span className="flex-1" />
        {pattern && <Chip tone={kind}>{pattern}</Chip>}
      </div>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-title-l tracking-tight">{errorName(item)}</h3>
          <p className="mt-1 text-body text-text-secondary">{metaLine(item)}</p>
        </div>
        <div className="text-right">
          <p className={cn("num text-num-hero tracking-tight", kind === "stop" ? "text-status-stop" : kind === "defect" ? "text-status-defect" : "text-status-speed")}>{fmt(item.loss_pcs)}</p>
          <p className="text-caption text-text-tertiary">pcs lost</p>
        </div>
      </div>
      {item.fix && (
        <div className="rounded-[16px] bg-status-fix-bg px-3.5 py-3">
          <p className="flex items-center gap-1.5">
            <Check className="size-4 text-status-fix" strokeWidth={2.6} />
            <Overline className="!text-status-fix">Solution</Overline>
          </p>
          <p className="mt-1.5 text-body font-medium text-text-primary">{item.fix.action}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {item.fix?.owner_role && <Chip>{item.fix.owner_role}</Chip>}
        {gain > 0 && <Chip tone="fix">+{gain.toFixed(2)} pp OEE</Chip>}
        <span className="flex-1" />
        <span
          role="button"
          tabIndex={0}
          onClick={assigned || busy ? (e) => e.stopPropagation() : assign}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-chip px-3.5 text-caption font-medium transition active:scale-95", assigned ? "bg-status-fix-bg text-status-fix" : "bg-bg-ink text-white")}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : assigned ? <Check className="size-3.5" strokeWidth={2.6} /> : null}
          {assigned ? "Assigned" : "Assign"}
        </span>
      </div>
    </Card>
  );
}

function metaLine(l: LossWithFix): string {
  const kind = KIND_OF[l.type];
  if (kind === "stop") return `${l.count}× · ${fmt(l.loss_pcs)} min stopped`;
  if (kind === "defect") return `${l.count}× · ${l.description}`;
  return `${l.count}× · −${l.loss_pp.toFixed(2)} pp OEE`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
