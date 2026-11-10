import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, Plus } from "lucide-react";
import { useActions, useInsights } from "@/api/hooks";
import { cn } from "@/lib/utils";
import { KIND_LABEL, deviceName, fixSteps, patternNote, useErrorDetail } from "./model";
import { Card, Chip, IconButton, Overline, PatternGrid, PrimaryButton, StatCard, StateCard } from "./ui";

/** 03 Error detail: when it happens and how to fix it. */
export default function ErrorDetail({ code, onBack, embedded = false }: { code: string; onBack?: () => void; embedded?: boolean }) {
  const detail = useErrorDetail(code);
  const { createAction, data: actions } = useActions();
  const insights = useInsights();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const d = detail.data;
  const owner = d?.fix?.owner_role ?? "team leader";
  const title = d?.fix?.action ?? `Remove ${code}`;
  const already = !!actions?.some((a) => a.title === title && a.status !== "done");

  async function create() {
    if (!d) return;
    setBusy(true);
    setErr(null);
    try {
      const insight = insights.data?.find((i) => i.code === code);
      await createAction({ title, owner: d.fix?.owner_role ?? null, insight_id: insight?.id ?? null });
      navigate("/actions");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex min-h-full flex-col", !embedded && "pb-28")}>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          {onBack && <IconButton label="Back to top errors" onClick={onBack} />}
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
          <p className="mt-1 text-body text-text-secondary">{d?.description ?? " "}</p>
        </div>

        {detail.error && !d ? (
          <StateCard state="error" error={detail.error} />
        ) : !d ? (
          <StateCard state="loading" />
        ) : (
          <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div className="flex gap-2.5">
              <StatCard label="Times" value={String(d.count)} />
              {d.kind === "defect" ? (
                <StatCard label="Scrapped" value={fmt(d.loss_pcs)} unit="pcs" />
              ) : (
                <StatCard label={d.kind === "stop" ? "Stopped" : "Lost time"} value={fmt(d.minutes)} unit="min" />
              )}
              <StatCard label="Lost" value={fmt(d.loss_pcs)} unit="pcs" tone="stop" />
            </div>

            <Card className="space-y-3">
              <div className="flex items-center">
                <h2 className="flex-1 text-title-m">When it happens</h2>
                <span className="text-caption font-medium text-text-tertiary">{periodLabel(d.occurrences)}</span>
              </div>
              <PatternGrid cells={d.pattern} tone={d.kind} />
              {patternNote(d) && (
                <div className={cn("flex items-center gap-2 rounded-badge px-3 py-2.5 text-caption font-medium", d.next_expected ? "bg-status-stop-bg text-status-stop" : "bg-bg-subtle text-text-secondary")}>
                  <Clock className="size-4 shrink-0" strokeWidth={2.2} />
                  {patternNote(d)}
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Check className="size-4 text-status-fix" strokeWidth={2.6} />
                <Overline className="flex-1 !text-status-fix">Solution</Overline>
                {d.gain_pp > 0 && <Chip tone="fix">+{d.gain_pp.toFixed(2)} pp OEE</Chip>}
              </div>
              {d.fix ? (
                <>
                  <ol className="space-y-2.5">
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
            {err && <p className="px-1 text-caption text-status-stop">{err}</p>}
          </motion.div>
        )}
      </div>

      {d && (
        <div className={cn(embedded ? "mt-3" : "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/90 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:mt-3 lg:border-0 lg:bg-transparent lg:p-0")}>
          {already ? (
            <PrimaryButton onClick={() => navigate("/actions")} className="bg-status-fix">
              <Check className="size-[18px]" strokeWidth={2.4} /> Action already open — view fixes
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={create} busy={busy}>
              <Plus className="size-[18px]" strokeWidth={2.4} /> Create action for {owner}
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function periodLabel(occ: { start: string }[]): string {
  if (!occ.length) return "";
  const f = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const a = f(occ[0].start);
  const b = f(occ[occ.length - 1].start);
  return a === b ? a : `${a} – ${b}`;
}
