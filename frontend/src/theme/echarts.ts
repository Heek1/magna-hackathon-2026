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
import { colors, fonts, radius, shadow } from "./tokens";

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
  axisLine: { show: true, lineStyle: { color: colors.line } },
  axisTick: { show: false },
  axisLabel: { color: colors.tertiary, fontFamily: mono, fontSize: 12 },
  splitLine: { show: true, lineStyle: { color: colors.line, width: 1 } },
  nameTextStyle: { color: colors.tertiary, fontFamily: sans, fontSize: 11 },
};

echarts.registerTheme(THEME, {
  color: [colors.speed, colors.tertiary, colors.defect, colors.fix, colors.stop],
  backgroundColor: "transparent",
  textStyle: { fontFamily: sans, color: colors.secondary },
  categoryAxis: { ...axis, splitLine: { show: false } },
  valueAxis: { ...axis, axisLine: { show: false } },
  legend: { textStyle: { color: colors.secondary, fontFamily: sans, fontSize: 12 }, icon: "rect", itemWidth: 10, itemHeight: 10 },
  tooltip: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: colors.primary, fontFamily: sans, fontSize: 13 },
    extraCssText: `box-shadow:${shadow.card};border-radius:${radius.badge};`,
  },
  markLine: { lineStyle: { color: colors.tertiary } },
});

/** Shared tooltip row helper so every chart's tooltip looks the same. */
export function tooltipRow(label: string, value: string, color?: string) {
  const dot = color ? `<span style="display:inline-block;width:8px;height:8px;background:${color};margin-right:6px"></span>` : "";
  return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${colors.secondary}">${dot}${label}</span><span style="font-family:${mono}">${value}</span></div>`;
}

export { echarts };
