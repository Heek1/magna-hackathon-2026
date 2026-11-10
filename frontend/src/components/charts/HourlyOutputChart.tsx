import { useMemo } from "react";
import type { ShiftKpis } from "@/types/api";
import { EChart } from "@/components/charts/EChart";
import { colors, fonts } from "@/theme/tokens";
import { tooltipRow } from "@/theme/echarts";
import { hourLabel } from "@/lib/format";

export interface HourlyOutputChartProps {
  hours: ShiftKpis[];
  /** Shift hour (1..8) that is running now; marked when the line is stopped. */
  currentHour?: number;
  /** True while there is an active downtime — the current hour gets a pulsing marker. */
  stoppedNow?: boolean;
  /** Ideal pieces per full hour (60 s cycle). */
  idealPerHour?: number;
  className?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];
const mono = fonts.mono.join(",");

/** Output per shift hour (OK + NOK stacked) against the 60 pcs/h ideal, with downtime markers. */
export function HourlyOutputChart({
  hours,
  currentHour,
  stoppedNow,
  idealPerHour = 60,
  className,
}: HourlyOutputChartProps) {
  const option = useMemo(() => {
    const byHour = new Map(hours.map((h) => [h.hour, h]));
    const ok = HOURS.map((h) => byHour.get(h)?.ok ?? null);
    const nok = HOURS.map((h) => byHour.get(h)?.nok ?? null);
    const stops = HOURS.flatMap((h, i) => {
      const k = byHour.get(h);
      return k && k.downtime_min > 0 ? [{ i, k }] : [];
    });
    const maxY = Math.max(idealPerHour, ...hours.map((h) => h.produced)) + 14;

    return {
      grid: { left: 8, right: 16, top: 28, bottom: 4, containLabel: true },
      legend: { right: 0, top: 0, data: ["OK", "NOK"] },
      xAxis: { type: "category", data: HOURS.map(hourLabel) },
      yAxis: { type: "value", min: 0, max: maxY, interval: 20 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(255,255,255,0.03)" } },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0].dataIndex;
          const k = byHour.get(HOURS[i]);
          let html = `<div style="font-weight:600;margin-bottom:4px">${hourLabel(HOURS[i])}–${hourLabel(HOURS[i] + 1)}</div>`;
          if (!k) return html + `<span style="color:${colors.dim}">Not produced yet</span>`;
          html += tooltipRow("Produced", `${k.produced} pcs`, colors.data);
          html += tooltipRow("NOK", `${k.nok} pcs`, colors.warn);
          html += tooltipRow("Plan", `${k.plan_min} min`);
          if (k.downtime_min > 0) html += tooltipRow("Downtime", `${k.downtime_min} min`, colors.warn);
          html += tooltipRow("OEE", `${(k.oee * 100).toFixed(1)} %`);
          return html;
        },
      },
      series: [
        {
          id: "ok",
          name: "OK",
          type: "bar",
          stack: "out",
          barWidth: "56%",
          itemStyle: { color: colors.data },
          data: ok,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: colors.muted, type: [6, 4], width: 1 },
            label: {
              position: "insideEndTop",
              formatter: `${idealPerHour} pcs/h`,
              color: colors.muted,
              fontFamily: mono,
              fontSize: 11,
            },
            data: [{ yAxis: idealPerHour }],
          },
        },
        {
          id: "nok",
          name: "NOK",
          type: "bar",
          stack: "out",
          itemStyle: { color: colors.warn },
          data: nok,
          label: {
            show: true,
            position: "top",
            fontFamily: mono,
            fontSize: 14,
            color: colors.text,
            formatter: ({ dataIndex }: { dataIndex: number }) => {
              const k = byHour.get(HOURS[dataIndex]);
              return k ? String(k.produced) : "";
            },
          },
        },
        {
          // Past downtime: marker with minutes, near the top of the plot.
          id: "stops",
          type: "scatter",
          symbol: "triangle",
          symbolRotate: 180,
          symbolSize: 12,
          itemStyle: { color: colors.warn },
          data: stops.map(({ i }) => [i, maxY - 4]),
          label: {
            show: true,
            position: "left",
            distance: 6,
            fontFamily: mono,
            fontSize: 12,
            color: colors.warn,
            formatter: ({ dataIndex }: { dataIndex: number }) => `${stops[dataIndex].k.downtime_min} min`,
          },
          tooltip: { show: false },
          z: 5,
        },
        {
          // Active downtime: the only pulsing marker.
          id: "active",
          type: "effectScatter",
          symbolSize: 12,
          rippleEffect: { scale: 3, brushType: "stroke", period: 1.6 },
          itemStyle: { color: colors.crit },
          data: stoppedNow && currentHour ? [[currentHour - 1, maxY - 4]] : [],
          label: {
            show: true,
            position: "left",
            distance: 10,
            fontFamily: mono,
            fontSize: 12,
            color: colors.crit,
            formatter: "STOP",
          },
          tooltip: { show: false },
          z: 6,
        },
      ],
    };
  }, [hours, currentHour, stoppedNow, idealPerHour]);

  return <EChart option={option} className={className} />;
}
