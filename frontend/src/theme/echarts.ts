import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart, EffectScatterChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { colors, fonts } from "./tokens";

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  EffectScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export const THEME = "oee";

const sans = fonts.sans.join(",");
const mono = fonts.mono.join(",");

const axis = {
  axisLine: { show: true, lineStyle: { color: colors["border-strong"] } },
  axisTick: { show: false },
  axisLabel: { color: colors.muted, fontFamily: mono, fontSize: 12 },
  splitLine: { show: true, lineStyle: { color: colors.border, width: 1 } },
  nameTextStyle: { color: colors.dim, fontFamily: sans, fontSize: 11 },
};

echarts.registerTheme(THEME, {
  color: [colors.data, colors["data-2"], colors.warn, colors.ok, colors.crit],
  backgroundColor: "transparent",
  textStyle: { fontFamily: sans, color: colors.muted },
  categoryAxis: { ...axis, splitLine: { show: false } },
  valueAxis: { ...axis, axisLine: { show: false } },
  legend: { textStyle: { color: colors.muted, fontFamily: sans, fontSize: 12 }, icon: "rect", itemWidth: 10, itemHeight: 10 },
  tooltip: {
    backgroundColor: colors["surface-2"],
    borderColor: colors["border-strong"],
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: colors.text, fontFamily: sans, fontSize: 13 },
    extraCssText: "box-shadow:none;border-radius:4px;",
  },
  markLine: { lineStyle: { color: colors.dim } },
});

/** Shared tooltip row helper so every chart's tooltip looks the same. */
export function tooltipRow(label: string, value: string, color?: string) {
  const dot = color ? `<span style="display:inline-block;width:8px;height:8px;background:${color};margin-right:6px"></span>` : "";
  return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${colors.muted}">${dot}${label}</span><span style="font-family:${mono}">${value}</span></div>`;
}

export { echarts };
