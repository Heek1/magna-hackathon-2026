import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, Lightbulb, Plus } from "lucide-react";
import type { ErrorDetail as Detail } from "@/types/api";
import { useActions, useErrorDetail, useInsights, useSimState } from "@/api/hooks";
import { BottomBar } from "@/components/BottomBar";
import { Card, CardHeader } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PatternGrid } from "@/components/PatternGrid";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { KIND_LABEL, deviceName, fixSteps, fmt, patternNote } from "./model";
import { BackButton, Eyebrow, StatCard, StateCard } from "./ui";
import { WhatIfCard } from "./WhatIfCard";

/** 03 Error detail (/errors/:code) — when it happens and how to fix it. */
export default function ErrorDetailPage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const sim = useSimState();
  const detail = useErrorDetail(code || null, sim.data ? { to: sim.data.shift.date } : undefined);
  const { createAction, data: actions } = useActions();
  const insights = useInsights();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const d = detail.data;
  const owner = d?.fix?.owner_role ?? "Team leader";
  const title = d?.fix?.action ?? `Remove ${code}`;
  const already = !!actions?.some((a) => a.title === title && a.status !== "done");
  const back = () => navigate(`/errors${params.get("tab") ? `?tab=${params.get("tab")}` : ""}`);

  async function create() {
    if (!d || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const insight = insights.data?.find((i) => i.code === code);
      await createAction({ title, owner: d.fix?.owner_role ?? null, insight_id: insight?.id ?? null });
      navigate("/fixes");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 pb-4">
        <div className="flex items-center gap-3">
          {!desktop && <BackButton onClick={back} />}
          <span className="flex-1" />
          {d && (
            <Chip tone={d.kind}>
              {KIND_LABEL[d.kind]}
              {d.device ? ` · ${deviceName(d.device)}` : ""}
            </Chip>
          )}
        </div>

        <div className="px-1">
          <h1 className="text-display tracking-tight">{code}</h1>
          <p className="mt-1 min-h-5 text-body text-text-secondary">{d?.description}</p>
        </div>

        {!d ? (
          <StateCard state={detail.error ? "error" : "loading"} error={detail.error} />
        ) : (
          <motion.div className="flex flex-col gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="flex gap-2.5">
              <StatCard label="Times" value={String(d.count)} />
              {d.kind === "defect" ? (
                <StatCard label="Scrapped" value={fmt(d.loss_pcs)} unit="pcs" />
              ) : (
                <StatCard label={d.kind === "stop" ? "Stopped" : "Lost time"} value={fmt(d.minutes)} unit="min" />
              )}
              <StatCard label="Lost" value={fmt(d.loss_pcs)} unit="pcs" tone="stop" />
            </div>

            <Card className="flex flex-col gap-3">
              <CardHeader title="When it happens" meta={periodLabel(d.occurrences)} />
              <PatternGrid cells={d.pattern} tone={d.kind} />
              {patternNote(d) && (
                <div className={cn("flex items-center gap-2 rounded-badge px-3 py-2.5 text-caption font-medium", d.next_expected ? "bg-status-stop-bg text-status-stop" : "bg-bg-subtle text-text-secondary")}>
                  <Clock className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                  {patternNote(d)}
                </div>
              )}
              {d.why && (
                <p className="flex gap-2 text-caption text-text-secondary">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-status-defect" aria-hidden />
                  {d.why}
                </p>
              )}
            </Card>

            <Solution d={d} />
            <WhatIfCard code={code} />
            {err && <p className="px-1 text-caption text-status-stop">{err}</p>}
          </motion.div>
        )}
      </div>

      {d &&
        (already ? (
          <BottomBar label="Action already open — view fixes" icon={Check} onClick={() => navigate("/fixes")} className={desktop ? "mx-0 border-0 bg-transparent px-0" : undefined} />
        ) : (
          <BottomBar label={`Create action for ${owner}`} icon={Plus} onClick={create} disabled={busy} className={desktop ? "mx-0 border-0 bg-transparent px-0" : undefined} />
        ))}
    </div>
  );
}

function Solution({ d }: { d: Detail }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Check className="size-4 text-status-fix" strokeWidth={2.6} aria-hidden />
        <Eyebrow className="flex-1 !text-status-fix">Solution</Eyebrow>
        {d.gain_pp > 0 && <Chip tone="fix">+{d.gain_pp.toFixed(2)} pp OEE</Chip>}
      </div>
      {d.fix ? (
        <>
          <ol className="flex flex-col gap-2.5">
            {fixSteps(d.fix.action).map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="num mt-px grid size-[22px] shrink-0 place-items-center rounded-full bg-status-fix-bg text-[11px] text-status-fix">{i + 1}</span>
                <span className="text-body font-medium">{s}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            {d.fix.method && <Chip tone="speed">{d.fix.method}</Chip>}
            {d.fix.owner_role && <Chip>Owner: {d.fix.owner_role}</Chip>}
          </div>
        </>
      ) : (
        <p className="text-body text-text-secondary">No countermeasure in the knowledge base yet.</p>
      )}
    </Card>
  );
}

function periodLabel(occ: { start: string }[]): string {
  if (!occ.length) return "";
  const f = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const a = f(occ[0].start);
  const b = f(occ[occ.length - 1].start);
  return a === b ? a : `${a} – ${b}`;
}
