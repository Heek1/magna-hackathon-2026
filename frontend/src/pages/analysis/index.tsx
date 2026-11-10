import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { EventKind, Loss } from "@/types/api";
import { useActions, useErrorDetail, useInsights, useLosses, useSimState } from "@/api/hooks";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { RankRow } from "@/components/RankRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { toneText } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { KIND_OF, errorName, fmt, patternLabel } from "./model";
import { Eyebrow, ScreenHeader, StateCard } from "./ui";

const TABS: { value: EventKind; label: string }[] = [
  { value: "stop", label: "Stops" },
  { value: "defect", label: "Defects" },
  { value: "speed", label: "Speed" },
];

/** 02 Top errors — what to fix first. Tap an error → /errors/:code. */
export default function TopErrorsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as EventKind | null) ?? "stop";
  const sim = useSimState();
  const period = sim.data ? { to: sim.data.shift.date } : null;
  const losses = useLosses(period);
  const navigate = useNavigate();
  const open = (code: string) => navigate(`/errors/${encodeURIComponent(code)}${tab === "stop" ? "" : `?tab=${tab}`}`);

  const all = useMemo(() => losses.data ?? [], [losses.data]);
  const items = useMemo(() => all.filter((l) => KIND_OF[l.type] === tab).sort((a, b) => b.loss_pcs - a.loss_pcs), [all, tab]);
  const counts = useMemo(() => {
    const c: Record<EventKind, number> = { stop: 0, defect: 0, speed: 0 };
    for (const l of all) c[KIND_OF[l.type]]++;
    return c;
  }, [all]);
  const month = sim.data ? new Date(sim.data.sim_time).toLocaleDateString("en-GB", { month: "long" }).toUpperCase() : "THIS MONTH";

  return (
    <div className="flex flex-col gap-3.5 pb-4">
      <ScreenHeader eyebrow={`${month} · BY PIECES LOST`} title="Top errors" />
      <SegmentedControl
        label="Error type"
        value={tab}
        onChange={(v) => setParams(v === "stop" ? {} : { tab: v }, { replace: true })}
        options={TABS.map((t) => ({ ...t, label: losses.data ? `${t.label} ${counts[t.value]}` : t.label }))}
      />
      {losses.data === undefined ? (
        <StateCard state={losses.error ? "error" : "loading"} error={losses.error} />
      ) : items.length === 0 ? (
        <StateCard state="empty" empty={`No ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} so far this month`} />
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={tab} className="flex flex-col gap-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <FixFirst item={items[0]} kind={tab} period={period ?? undefined} onOpen={() => open(items[0].code)} />
            {items.length > 1 && (
              <div className="flex items-baseline px-1 pt-1">
                <h2 className="flex-1 text-title-m">Next to fix</h2>
                <span className="text-caption text-text-tertiary">{items.length} total</span>
              </div>
            )}
            {items.slice(1, 8).map((l, i) => (
              <RankRow
                key={l.code + (l.device ?? "")}
                rank={i + 2}
                title={errorName(l)}
                meta={metaLine(l)}
                value={l.loss_pcs}
                ratio={l.loss_pcs / items[0].loss_pcs}
                tone={tab}
                onClick={() => open(l.code)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function FixFirst({ item, kind, period, onOpen }: { item: Loss; kind: EventKind; period?: { to: string }; onOpen: () => void }) {
  const detail = useErrorDetail(item.code, period);
  const { createAction, data: actions } = useActions();
  const insights = useInsights();
  const [busy, setBusy] = useState(false);
  const pattern = detail.data ? patternLabel(detail.data) : null;
  const gain = detail.data?.gain_pp ?? item.loss_pp;
  const title = item.fix?.action ?? `Remove ${item.code}`;
  const assigned = !!actions?.some((a) => a.title === title && a.status !== "done");

  async function assign(e: React.MouseEvent) {
    e.stopPropagation();
    if (assigned || busy) return;
    setBusy(true);
    try {
      const insight = insights.data?.find((i) => i.code === item.code);
      await createAction({ title, owner: item.fix?.owner_role ?? null, insight_id: insight?.id ?? null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      tone="stop"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="flex cursor-pointer flex-col gap-3.5 !p-[18px] transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        <Chip tone="stop" variant="solid">#1 Fix first</Chip>
        <span className="flex-1" />
        {pattern && <Chip tone={kind}>{pattern}</Chip>}
      </div>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-title-l tracking-tight">{errorName(item)}</h3>
          <p className="mt-1 text-body text-text-secondary">{metaLine(item)}</p>
        </div>
        <div className="text-right">
          <p className={cn("num text-num-hero tracking-tight", toneText[kind])}>{fmt(item.loss_pcs)}</p>
          <p className="text-caption text-text-tertiary">pcs lost</p>
        </div>
      </div>
      {item.fix && (
        <div className="rounded-[16px] bg-status-fix-bg px-3.5 py-3">
          <p className="flex items-center gap-1.5">
            <Check className="size-4 text-status-fix" strokeWidth={2.6} aria-hidden />
            <Eyebrow className="!text-status-fix">Solution</Eyebrow>
          </p>
          <p className="mt-1.5 text-body font-medium text-text-primary">{item.fix.action}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {item.fix?.owner_role && <Chip>{item.fix.owner_role}</Chip>}
        {gain > 0 && <Chip tone="fix">+{gain.toFixed(2)} pp OEE</Chip>}
        <span className="flex-1" />
        <button
          onClick={assign}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-chip px-3.5 text-caption font-medium transition active:scale-95",
            assigned ? "bg-status-fix-bg text-status-fix" : "bg-bg-ink text-white",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : assigned ? <Check className="size-3.5" strokeWidth={2.6} /> : null}
          {assigned ? "Assigned" : "Assign"}
        </button>
      </div>
    </Card>
  );
}

function metaLine(l: Loss): string {
  const kind = KIND_OF[l.type];
  if (kind === "stop") return `${l.count}× · ${fmt(l.loss_pcs)} min stopped`;
  if (kind === "defect") return `${l.count}× · ${l.description}`;
  return `${l.count}× · −${l.loss_pp.toFixed(2)} pp OEE`;
}
