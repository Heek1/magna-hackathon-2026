/**
 * Design tokens — the single source of truth.
 * Tailwind (tailwind.config.ts) and the ECharts theme (theme/echarts.ts) both read from here.
 * Do not hardcode colors anywhere else.
 */

export const colors = {
  bg: "#0B0E12", // near-black, cool tint
  surface: "#12161C", // panels
  "surface-2": "#181D25", // raised / hover
  border: "#232A33", // thin 1px borders instead of shadows
  "border-strong": "#2E3742",
  text: "#E6EAF0", // numbers, primary text
  muted: "#8A94A3", // labels
  dim: "#5B6573", // axes, tertiary
  accent: "#E4002B", // Magna red — ONLY for things that require action
  ok: "#3FB950",
  warn: "#E3A008",
  crit: "#E4002B", // critical == requires action == accent
  data: "#8FA3BF", // primary chart series
  "data-2": "#4E5D70", // secondary series: ideal / plan
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
  mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
};

/** Font sizes: [size, lineHeight, letterSpacing] — numbers are readable from 3 m on a 1080p projector. */
export const fontSize = {
  "kpi-hero": ["104px", { lineHeight: "0.9", letterSpacing: "-0.07em" }],
  kpi: ["64px", { lineHeight: "1", letterSpacing: "-0.05em" }],
  "num-lg": ["40px", { lineHeight: "1", letterSpacing: "-0.01em" }],
  "num-md": ["24px", { lineHeight: "1.1" }],
  label: ["11px", { lineHeight: "1.2", letterSpacing: "0.08em" }],
} as const;

export const radius = "4px";

/** Motion — only meaningful animation. Durations in seconds. */
export const motion = {
  number: 0.6, // smooth number change
  enter: 0.25, // new insight appearing
  pulse: 1.6, // active downtime pulse period
  ease: [0.2, 0, 0, 1] as [number, number, number, number],
};

/** OEE components have no target in the contract; these are the team's frontend constants. */
export const kpiTargets = {
  availability: 0.9,
  performance: 0.95,
  quality: 0.99,
} as const;

/** Below target by up to this much (fraction) → warn; further → crit. */
export const warnBand = 0.02;
