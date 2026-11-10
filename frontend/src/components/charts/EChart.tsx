import { useEffect, useRef } from "react";
import type { EChartsCoreOption, ECharts } from "echarts/core";
import { echarts, THEME } from "@/theme/echarts";
import { cn } from "@/lib/utils";

export interface EChartProps {
  option: EChartsCoreOption;
  className?: string;
  /** Replace instead of merge (use when series are added/removed). */
  notMerge?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

/**
 * ECharts in the project theme. Size comes from the container (give it a height via className).
 * Updates merge into the existing chart so values animate instead of redrawing.
 */
export function EChart({ option, className, notMerge = false, onEvents }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, THEME, { renderer: "canvas" });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge, lazyUpdate: true });
  }, [option, notMerge]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !onEvents) return;
    Object.entries(onEvents).forEach(([name, fn]) => c.on(name, fn));
    return () => Object.keys(onEvents).forEach((name) => c.off(name));
  }, [onEvents]);

  return <div ref={el} className={cn("h-full w-full min-h-0", className)} />;
}
