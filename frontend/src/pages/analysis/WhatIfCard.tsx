import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import type { WhatIfResponse } from "@/types/api";
import { api, errorText } from "@/api/client";
import { useSimState } from "@/api/hooks";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Card } from "@/components/Card";
import { motion as tokens } from "@/theme/tokens";
import { Eyebrow } from "./ui";

const pct = (v: number) => `${(v * 100).toFixed(1)}`;
const whole = (v: number) => `+${Math.round(v)}`;
const pp = (v: number) => `+${v.toFixed(2)}`;

/**
 * "If we fix it": OEE of the month so far, before and after removing this error (POST /api/whatif).
 * Same model as the pitch numbers: removed stop minutes run at the period's own speed and quality.
 */
export function WhatIfCard({ code }: { code: string }) {
  const sim = useSimState();
  const day = sim.data?.shift.date ?? null; // refetch once per simulated day
  const target = sim.data?.shift.target ?? 0.85;
  const [data, setData] = useState<WhatIfResponse>();
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<number | null>(null); // animates from before to after
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!day) return;
    const ctrl = new AbortController();
    api<WhatIfResponse>("/whatif", {
      method: "POST",
      json: { remove: [code], from: `${day.slice(0, 8)}01`, to: day },
      signal: ctrl.signal,
    })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => e.name !== "AbortError" && setError(errorText(e)));
    return () => ctrl.abort();
  }, [code, day]);

  useEffect(() => {
    if (!data) return;
    setShown(data.oee_before);
    const t = window.setTimeout(() => setShown(data.oee_after), reduce ? 0 : 350);
    return () => window.clearTimeout(t);
  }, [data, reduce]);

  if (error && !data) return null; // optional block: never break the screen
  if (!data || shown === null)
    return <div className="h-[170px] animate-pulse rounded-card bg-bg-card/70 shadow-card" aria-busy />;
  if (data.gain_pcs <= 0) return null;

  // Bar from 80 % to 95 %: enough room to see a 1 pp step.
  const lo = 0.8;
  const hi = 0.95;
  const x = (v: number) => `${Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100}%`;
  const month = new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { month: "long" });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-status-fix" strokeWidth={2.4} aria-hidden />
        <Eyebrow className="flex-1 !text-status-fix">If we fix it</Eyebrow>
        <span className="text-caption text-text-tertiary">{month} so far</span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-caption text-text-secondary">OEE</p>
          <p className="flex items-baseline gap-2">
            <span className="num text-num-m text-text-tertiary line-through decoration-text-tertiary/60">{pct(data.oee_before)}%</span>
            <span className="text-text-tertiary" aria-hidden>
              →
            </span>
            <span className="num text-num-hero leading-none tracking-tight text-text-primary">
              <AnimatedNumber value={shown} format={pct} />
              <span className="text-num-m">%</span>
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="num text-num-l leading-none text-status-fix">
            <AnimatedNumber value={shown === data.oee_before ? 0 : data.gain_pcs} format={whole} />
          </p>
          <p className="mt-1 text-caption text-text-secondary">good pcs</p>
        </div>
      </div>

      <div>
        <div className="relative h-2.5 rounded-full bg-bg-subtle" role="img" aria-label={`OEE ${pct(data.oee_before)}% now, ${pct(data.oee_after)}% with this fix, target ${pct(target)}%`}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-text-tertiary/50" style={{ width: x(data.oee_before) }} />
          <motion.div
            className="absolute inset-y-0 rounded-r-full bg-status-fix"
            style={{ left: x(data.oee_before) }}
            initial={{ width: 0 }}
            animate={{ width: `calc(${x(data.oee_after)} - ${x(data.oee_before)})` }}
            transition={{ duration: reduce ? 0 : tokens.number, delay: reduce ? 0 : 0.35, ease: tokens.ease }}
          />
          <div className="absolute -inset-y-1 w-0.5 rounded-full bg-text-primary" style={{ left: x(target) }} aria-hidden />
        </div>
        <div className="num relative mt-1.5 h-4 text-[11px] text-text-tertiary">
          <span className="absolute left-0">80%</span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-text-secondary" style={{ left: x(target) }}>
            target {pct(target).replace(".0", "")}%
          </span>
          <span className="absolute right-0">95%</span>
        </div>
      </div>

      <p className="text-caption text-text-secondary">
        <span className="num font-medium text-status-fix">{pp(data.gain_pp)} pp</span> of OEE. The lost minutes run at this
        month's own speed and quality.
      </p>
    </Card>
  );
}
