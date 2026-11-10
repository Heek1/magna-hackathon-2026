import { useMemo, useState } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { Panel } from "@/components/Panel";
import { EChart } from "@/components/charts/EChart";
import { useHistory, useHeatmap, useLosses } from "@/api/hooks";
import { colors } from "@/theme/tokens";
import { pctUnit } from "@/lib/format";
import type { HeatmapMetric } from "@/types/api";

export default function AnalysisPage() {
  const [from, setFrom] = useState("2026-11-02");
  const [to, setTo] = useState("2026-11-30");
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("oee");
  const [paretoKind, setParetoKind] = useState<"downtime" | "nok">("downtime");

  const history = useHistory({ from, to });
  const heatmap = useHeatmap(heatmapMetric);
  const losses = useLosses({ from, to });

  // 1. Daily OEE chart options
  const oeeChartOption = useMemo<EChartsCoreOption>(() => {
    const data = history.data ?? [];
    const dates = data.map((d) => d.date.slice(5)); // MM-DD
    const oeeValues = data.map((d) => Number((d.oee * 100).toFixed(1)));

    return {
      grid: { left: 45, right: 20, top: 25, bottom: 25 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          if (!params || !params[0]) return "";
          const idx = params[0].dataIndex;
          const point = data[idx];
          if (!point) return "";
          return `
            <div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;min-width:180px">
              <div style="font-weight:600;margin-bottom:6px;color:${colors.text}">${point.date}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
                <span style="color:${colors.muted}">OEE</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${point.oee >= 0.85 ? colors.ok : colors.crit}">${pctUnit(point.oee)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
                <span style="color:${colors.dim}">Availability</span>
                <span style="font-family:'IBM Plex Mono',monospace">${pctUnit(point.availability)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
                <span style="color:${colors.dim}">Performance</span>
                <span style="font-family:'IBM Plex Mono',monospace">${pctUnit(point.performance)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
                <span style="color:${colors.dim}">Quality</span>
                <span style="font-family:'IBM Plex Mono',monospace">${pctUnit(point.quality)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:4px;border-top:1px solid ${colors["border-strong"]};padding-top:4px">
                <span style="color:${colors.warn}">Downtime</span>
                <span style="font-family:'IBM Plex Mono',monospace;color:${colors.warn}">${point.downtime_min} min</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px">
                <span style="color:${colors.crit}">Scrap (NOK)</span>
                <span style="font-family:'IBM Plex Mono',monospace;color:${colors.crit}">${point.nok} pcs</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: dates,
      },
      yAxis: {
        type: "value",
        min: 70,
        max: 100,
        axisLabel: { formatter: "{value}%" },
      },
      series: [
        {
          name: "OEE",
          type: "bar",
          barWidth: "55%",
          data: oeeValues.map((val) => ({
            value: val,
            itemStyle: {
              color: val >= 85 ? colors.ok : colors.crit,
            },
          })),
          markLine: {
            symbol: ["none", "none"],
            lineStyle: {
              type: "dashed",
              color: colors.muted,
              width: 1.5,
            },
            data: [
              {
                yAxis: 85,
                label: {
                  formatter: "Target: 85%",
                  position: "insideEndTop",
                  color: colors.muted,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 11,
                },
              },
            ],
          },
        },
      ],
    };
  }, [history.data]);

  // 2. Pareto analysis data & chart options
  const { paretoItems, paretoOption } = useMemo(() => {
    const raw = losses.data ?? [];
    const isNok = paretoKind === "nok";
    const filtered = raw.filter((item) => (isNok ? item.type === "nok" : item.type !== "nok"));

    // Group by code and sort descending by loss_pcs
    const map = new Map<string, { code: string; device: string; desc: string; pcs: number; pp: number; count: number }>();
    filtered.forEach((f) => {
      const prev = map.get(f.code) ?? { code: f.code, device: f.device ?? "General", desc: f.description, pcs: 0, pp: 0, count: 0 };
      map.set(f.code, {
        code: f.code,
        device: f.device ?? prev.device,
        desc: f.description || prev.desc,
        pcs: prev.pcs + f.loss_pcs,
        pp: prev.pp + f.loss_pp,
        count: prev.count + f.count,
      });
    });

    const items = Array.from(map.values()).sort((a, b) => b.pcs - a.pcs);
    const totalPcs = items.reduce((sum, item) => sum + item.pcs, 0) || 1;

    let cum = 0;
    const withCum = items.map((item) => {
      cum += item.pcs;
      return {
        ...item,
        cumPct: Math.round((cum / totalPcs) * 100),
      };
    });

    const top8 = withCum.slice(0, 8);
    const codes = top8.map((t) => t.code);
    const pcsValues = top8.map((t) => t.pcs);
    const cumValues = top8.map((t) => t.cumPct);

    const option: EChartsCoreOption = {
      grid: { left: 45, right: 45, top: 25, bottom: 30 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
      },
      xAxis: {
        type: "category",
        data: codes,
      },
      yAxis: [
        {
          type: "value",
          name: "Pieces",
          axisLabel: { formatter: "{value}" },
        },
        {
          type: "value",
          name: "Cum %",
          min: 0,
          max: 100,
          axisLabel: { formatter: "{value}%" },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Loss (pcs)",
          type: "bar",
          barWidth: "40%",
          itemStyle: { color: colors.crit },
          data: pcsValues,
        },
        {
          name: "Cumulative %",
          type: "line",
          yAxisIndex: 1,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: { color: colors.warn },
          lineStyle: { color: colors.warn, width: 2 },
          data: cumValues,
          markLine: {
            symbol: ["none", "none"],
            lineStyle: { type: "dashed", color: colors.muted },
            data: [{ yAxis: 80, label: { formatter: "80%", position: "end" } }],
          },
        },
      ],
    };

    return { paretoItems: withCum, paretoOption: option };
  }, [losses.data, paretoKind]);

  // 3. Heatmap table
  const heatmapRows = useMemo(() => {
    const raw = heatmap.data ?? [];
    if (!raw.length) return [];
    const dateSet = Array.from(new Set(raw.map((r) => r.date))).sort();
    return dateSet.map((d) => {
      const hoursMap: Record<number, number> = {};
      for (let h = 1; h <= 8; h++) hoursMap[h] = 0;
      raw.filter((r) => r.date === d).forEach((r) => {
        hoursMap[r.hour] = r.value;
      });
      return { date: d, hours: hoursMap };
    });
  }, [heatmap.data]);

  const getHeatmapColor = (val: number) => {
    if (heatmapMetric === "downtime") {
      if (val === 0) return "bg-surface text-dim";
      if (val <= 10) return "bg-warn/20 text-warn border border-warn/30";
      return "bg-crit/20 text-crit font-bold border border-crit/40";
    }
    // OEE or Performance
    if (val >= 0.95) return "bg-ok/20 text-ok font-semibold";
    if (val >= 0.85) return "bg-ok/10 text-ok/80";
    if (val >= 0.80) return "bg-warn/20 text-warn";
    return "bg-crit/20 text-crit font-bold";
  };

  return (
    <div className="flex flex-col gap-4 p-4 min-h-0 overflow-y-auto">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="label text-muted">Period:</span>
          <div className="flex items-center gap-1.5 font-mono text-xs text-text bg-bg border border-border px-2 py-1 rounded">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            />
            <span className="text-dim">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setFrom("2026-11-02"); setTo("2026-11-30"); }}
            className="px-2 py-0.5 text-label uppercase rounded border border-border hover:bg-surface-2 text-text transition-colors"
          >
            Full Month
          </button>
          <button
            onClick={() => { setFrom("2026-11-02"); setTo("2026-11-06"); }}
            className="px-2 py-0.5 text-label uppercase rounded border border-border hover:bg-surface-2 text-text transition-colors"
          >
            W1
          </button>
          <button
            onClick={() => { setFrom("2026-11-09"); setTo("2026-11-13"); }}
            className="px-2 py-0.5 text-label uppercase rounded border border-border hover:bg-surface-2 text-text transition-colors"
          >
            W2
          </button>
          <button
            onClick={() => { setFrom("2026-11-16"); setTo("2026-11-20"); }}
            className="px-2 py-0.5 text-label uppercase rounded border border-border hover:bg-surface-2 text-text transition-colors"
          >
            W3
          </button>
          <button
            onClick={() => { setFrom("2026-11-23"); setTo("2026-11-27"); }}
            className="px-2 py-0.5 text-label uppercase rounded border border-border hover:bg-surface-2 text-text transition-colors"
          >
            W4
          </button>
        </div>
      </div>

      {/* 1. Daily OEE Chart with Target Line */}
      <Panel
        title="Daily OEE vs Target (85 %)"
        meta={`${from} to ${to}`}
        actions={
          <div className="flex items-center gap-3 text-label">
            <span className="flex items-center gap-1.5 text-ok">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ok" /> ≥85 % On Target
            </span>
            <span className="flex items-center gap-1.5 text-crit">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-crit" /> &lt;85 % Below Target
            </span>
          </div>
        }
        className="h-80"
      >
        <EChart option={oeeChartOption} />
      </Panel>

      {/* 2-Column Row: Heatmap & Pareto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        <Panel
          title="Hour × Day Loss Heatmap"
          meta={`Metric: ${heatmapMetric.toUpperCase()}`}
          actions={
            <div className="flex rounded border border-border bg-bg p-0.5 text-label uppercase">
              <button
                onClick={() => setHeatmapMetric("oee")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  heatmapMetric === "oee" ? "bg-border-strong text-text font-semibold" : "text-muted hover:text-text"
                }`}
              >
                OEE
              </button>
              <button
                onClick={() => setHeatmapMetric("performance")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  heatmapMetric === "performance" ? "bg-border-strong text-text font-semibold" : "text-muted hover:text-text"
                }`}
              >
                Speed
              </button>
              <button
                onClick={() => setHeatmapMetric("downtime")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  heatmapMetric === "downtime" ? "bg-border-strong text-text font-semibold" : "text-muted hover:text-text"
                }`}
              >
                Stops
              </button>
            </div>
          }
          className="min-h-[380px]"
        >
          <div className="overflow-x-auto max-h-[310px]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-surface border-b border-border text-muted">
                <tr>
                  <th className="py-1.5 px-2 font-normal text-label uppercase">Shift Date</th>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                    <th key={h} className="py-1.5 px-1 text-center font-normal text-label">
                      H{h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row) => (
                  <tr key={row.date} className="border-b border-border/50 hover:bg-surface-2/40">
                    <td className="py-1 px-2 text-muted font-mono text-[11px] whitespace-nowrap">
                      {row.date}
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => {
                      const val = row.hours[h] ?? 0;
                      return (
                        <td key={h} className="p-0.5 text-center">
                          <div className={`py-1 px-0.5 rounded text-[11px] tabular-nums ${getHeatmapColor(val)}`}>
                            {heatmapMetric === "downtime" ? `${val}m` : `${Math.round(val * 100)}%`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Pareto Chart & Table */}
        <Panel
          title="Pareto of Causes (80/20 Rule)"
          meta={`Filter: ${paretoKind === "downtime" ? "Downtime Stops" : "Scrap (NOK)"}`}
          actions={
            <div className="flex rounded border border-border bg-bg p-0.5 text-label uppercase">
              <button
                onClick={() => setParetoKind("downtime")}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  paretoKind === "downtime" ? "bg-border-strong text-text font-semibold" : "text-muted hover:text-text"
                }`}
              >
                Downtime
              </button>
              <button
                onClick={() => setParetoKind("nok")}
                className={`px-2.5 py-0.5 rounded transition-colors ${
                  paretoKind === "nok" ? "bg-border-strong text-text font-semibold" : "text-muted hover:text-text"
                }`}
              >
                Scrap
              </button>
            </div>
          }
          className="min-h-[380px]"
        >
          <div className="h-44 w-full mb-3">
            <EChart option={paretoOption} />
          </div>

          {/* Top Causes List */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {paretoItems.slice(0, 5).map((item, idx) => (
              <div
                key={item.code}
                className="flex items-center justify-between p-2 rounded bg-bg border border-border text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-dim text-[11px]">#{idx + 1}</span>
                  <strong className="text-text">{item.code}</strong>
                  <span className="text-muted text-[11px]">({item.device})</span>
                  <span className="text-dim truncate text-[11px] max-w-[180px]">{item.desc}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-crit">-{item.pcs} pcs</span>
                  <span className="text-dim text-[11px]">({item.pp.toFixed(2)} pp)</span>
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded border ${
                      item.cumPct <= 80 ? "border-warn/40 text-warn bg-warn/10" : "border-border text-muted"
                    }`}
                  >
                    {item.cumPct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
