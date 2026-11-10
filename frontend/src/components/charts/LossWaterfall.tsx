import { useMemo } from "react";
import type { Loss, ShiftKpis } from "@/types/api";
import { EChart } from "@/components/charts/EChart";
import { colors, fonts } from "@/theme/tokens";
import { tooltipRow } from "@/theme/echarts";
import { pcs, signed } from "@/lib/format";

export interface LossWaterfallProps {
  /** Totals for the period (shift so far, a day, …). */
  kpis: Pick<ShiftKpis, "plan_min" | "downtime_min" | "run_min" | "produced" | "nok" | "ok">;
  /** Optional: used to split the speed loss in the tooltip (microstop / retest / slowdown). */
  losses?: Loss[];
  className?: string;
}

/**
 * Loss waterfall in pieces (ideal cycle 60 s → 1 min of plan = 1 pc):
 * Ideal → −Downtime → −Speed → −Scrap → Good.
 */
export function LossWaterfall({ kpis, losses, className }: LossWaterfallProps) {
  const option = useMemo(() => {
    const ideal = kpis.plan_min;
    const downtime = kpis.downtime_min;
    const speed = kpis.run_min - kpis.produced;
    const scrap = kpis.nok;
    const good = kpis.ok;
    const ppOf = (n: number) => (ideal > 0 ? (n / ideal) * 100 : 0);

    const speedParts = (losses ?? [])
      .filter((l) => l.type === "microstop" || l.type === "retest" || l.type === "slowdown")
      .map((l) => ({ name: l.description, value: l.loss_pcs }));

    const cats = ["Ideal", "Downtime", "Speed", "Scrap", "Good"];
    const values = [ideal, downtime, speed, scrap, good];
    const bases = [0, ideal - downtime, ideal - downtime - speed, good, 0];
    const fills = [colors["data-2"], colors.warn, colors.warn, colors.warn, colors.ok];
    const isLoss = [false, true, true, true, false];

    return {
      grid: { left: 8, right: 8, top: 40, bottom: 4, containLabel: true },
      xAxis: {
        type: "category",
        data: cats,
        axisLabel: { fontFamily: fonts.sans.join(","), fontSize: 12, color: colors.muted },
      },
      yAxis: { type: "value", min: 0, splitNumber: 4 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.03)" } },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[1]?.dataIndex ?? params[0].dataIndex;
          const v = values[i];
          let html = `<div style="font-weight:600;margin-bottom:4px">${cats[i]}</div>`;
          html += tooltipRow(isLoss[i] ? "Lost" : "Pieces", `${isLoss[i] ? signed(-v) : pcs(v)} pcs`, fills[i]);
          if (isLoss[i]) html += tooltipRow("OEE impact", `${ppOf(v).toFixed(1)} pp`);
          if (i === 2) speedParts.forEach((p) => (html += tooltipRow(`· ${p.name}`, `${pcs(p.value)} pcs`)));
          return html;
        },
      },
      series: [
        {
          id: "base",
          type: "bar",
          stack: "w",
          silent: true,
          itemStyle: { color: "transparent" },
          data: bases,
        },
        {
          id: "value",
          type: "bar",
          stack: "w",
          barWidth: "56%",
          data: values.map((v, i) => ({ value: v, itemStyle: { color: fills[i] } })),
          label: {
            show: true,
            position: "top",
            fontFamily: fonts.mono.join(","),
            fontSize: 16,
            fontWeight: 500,
            color: colors.text,
            formatter: ({ dataIndex }: { dataIndex: number }) =>
              isLoss[dataIndex]
                ? `{loss|${signed(-values[dataIndex], Number.isInteger(values[dataIndex]) ? 0 : 1)}}\n{pp|${ppOf(values[dataIndex]).toFixed(1)} pp}`
                : pcs(values[dataIndex]),
            rich: {
              loss: { fontFamily: fonts.mono.join(","), fontSize: 16, fontWeight: 500, color: colors.warn },
              pp: { fontFamily: fonts.mono.join(","), fontSize: 11, color: colors.muted, padding: [2, 0, 0, 0] },
            },
          },
        },
      ],
    };
  }, [kpis, losses]);

  return <EChart option={option} className={className} />;
}
