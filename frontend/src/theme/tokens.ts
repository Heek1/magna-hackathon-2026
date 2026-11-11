/**
 * Design tokens — the single source of truth (docs/design-brief.md; names match the Figma variables).
 * Colors are CSS variables, so the light and dark themes switch without a reload.
 * Do not hardcode colors, sizes or shadows anywhere else.
 */

/** Figma: bg/*, text/*, border/*, status/*. Every theme has the same names. */
const light = {
  "bg-canvas": "#F3F4F7", // page background
  "bg-card": "#FFFFFF", // cards, tab bar
  "bg-subtle": "#F6F7F9", // empty cells, progress tracks, rank badge
  "bg-ink": "#0E1116", // hero status card, primary buttons
  "text-primary": "#0B0D12", // titles, numbers
  "text-secondary": "#5F6672", // supporting text
  "text-tertiary": "#9AA1AD", // labels, times, inactive tabs
  "border-default": "#E6E8EC", // dividers
  "border-strong": "#D5D9E0",
  stop: "#E5243B", // downtime, line stopped, #1 to fix
  "stop-bg": "#FDECEE",
  defect: "#F08A00", // scrap / quality
  "defect-bg": "#FFF4E5",
  speed: "#2F6BFF", // microstops, slowdown, retests
  "speed-bg": "#EAF0FF",
  fix: "#0E9F6E", // solutions, gains
  "fix-bg": "#E7F6EF",
};

type ThemeColors = typeof light;

const dark: ThemeColors = {
  "bg-canvas": "#0D1014",
  "bg-card": "#171B21",
  "bg-subtle": "#222830",
  "bg-ink": "#2A323E", // lighter than the cards, so the hero and primary buttons still stand out
  "text-primary": "#F2F4F7",
  "text-secondary": "#A7B0BD",
  "text-tertiary": "#7F8998",
  "border-default": "#2B323C",
  "border-strong": "#3A4350",
  stop: "#FF5A6E",
  "stop-bg": "#3B1A22",
  defect: "#FFA62B",
  "defect-bg": "#3A2A12",
  speed: "#7AA2FF",
  "speed-bg": "#1B2A4A",
  fix: "#34D399",
  "fix-bg": "#12332A",
};

export const themes = { light, dark };
export type ThemeName = keyof typeof themes;

/** "#E5243B" → "229 36 59", the form Tailwind needs for opacity modifiers like bg-status-stop/20. */
function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variables of a theme: { "--c-bg-canvas": "243 244 247", … }. */
export function themeVars(name: ThemeName): Record<string, string> {
  return Object.fromEntries(Object.entries(themes[name]).map(([k, v]) => [`--c-${k}`, channels(v)]));
}

/** Tone of anything that carries meaning: Chip, EventRow, RankRow, PatternGrid… */
export type Tone = "stop" | "defect" | "speed" | "fix" | "neutral";

const tw = (name: keyof ThemeColors) => `rgb(var(--c-${name}) / <alpha-value>)`;
const css = (name: keyof ThemeColors) => `rgb(var(--c-${name}))`;

/**
 * Deprecated: the old dark-theme names, mapped onto the current palette so pages that still use
 * them keep compiling and stay readable. Use the new classes in new code.
 */
const legacy = {
  surface: tw("bg-card"),
  "surface-2": tw("bg-subtle"),
  "border-strong": tw("border-strong"),
  muted: tw("text-secondary"),
  dim: tw("text-tertiary"),
  accent: tw("stop"),
  ok: tw("fix"),
  warn: tw("defect"),
  crit: tw("stop"),
  data: tw("speed"),
  "data-2": tw("text-tertiary"),
};

/** For SVG and inline styles; they follow the active theme: colors.card, colors.stop, colors["fix-bg"], … */
export const colors = {
  canvas: css("bg-canvas"),
  card: css("bg-card"),
  subtle: css("bg-subtle"),
  ink: css("bg-ink"),
  primary: css("text-primary"),
  secondary: css("text-secondary"),
  tertiary: css("text-tertiary"),
  line: css("border-default"),
  stop: css("stop"),
  "stop-bg": css("stop-bg"),
  defect: css("defect"),
  "defect-bg": css("defect-bg"),
  speed: css("speed"),
  "speed-bg": css("speed-bg"),
  fix: css("fix"),
  "fix-bg": css("fix-bg"),
} as const;

/** Tailwind color config: bg-bg-card, text-text-secondary, border-border, bg-status-stop-bg, … */
export const tailwindColors = {
  bg: {
    DEFAULT: tw("bg-canvas"),
    canvas: tw("bg-canvas"),
    card: tw("bg-card"),
    subtle: tw("bg-subtle"),
    ink: tw("bg-ink"),
  },
  text: {
    DEFAULT: tw("text-primary"),
    primary: tw("text-primary"),
    secondary: tw("text-secondary"),
    tertiary: tw("text-tertiary"),
  },
  border: { DEFAULT: tw("border-default"), default: tw("border-default") },
  status: {
    stop: { DEFAULT: tw("stop"), bg: tw("stop-bg") },
    defect: { DEFAULT: tw("defect"), bg: tw("defect-bg") },
    speed: { DEFAULT: tw("speed"), bg: tw("speed-bg") },
    fix: { DEFAULT: tw("fix"), bg: tw("fix-bg") },
  },
  ...legacy,
};

export const fonts = {
  // Geist Sans has no Cyrillic; Inter is loaded for Cyrillic only and draws the Ukrainian text.
  sans: ['"Geist Sans"', '"Inter"', "system-ui", "sans-serif"],
  mono: ['"Geist Mono"', "ui-monospace", "monospace"],
};

type FontSize = [string, { lineHeight: string; fontWeight?: string; letterSpacing?: string }];

/**
 * Type scale (Figma text styles). Text styles use Geist; num-* use Geist Mono — pair them with
 * `font-mono tabular-nums` (or the `.num` class).
 */
export const fontSize: Record<string, FontSize> = {
  display: ["34px", { lineHeight: "40px", fontWeight: "700" }],
  "title-l": ["22px", { lineHeight: "28px", fontWeight: "600" }],
  "title-m": ["17px", { lineHeight: "22px", fontWeight: "600" }],
  body: ["15px", { lineHeight: "20px" }], // Medium or Regular: set font-medium / font-normal
  caption: ["13px", { lineHeight: "18px" }],
  overline: ["11px", { lineHeight: "14px", fontWeight: "600", letterSpacing: "0.06em" }],
  "num-hero": ["44px", { lineHeight: "48px", fontWeight: "600" }],
  "num-l": ["28px", { lineHeight: "32px", fontWeight: "600" }],
  "num-m": ["17px", { lineHeight: "22px", fontWeight: "600" }],
  "num-s": ["13px", { lineHeight: "16px", fontWeight: "500" }],
  // deprecated aliases used by older pages
  label: ["11px", { lineHeight: "14px", fontWeight: "600", letterSpacing: "0.06em" }],
  "kpi-hero": ["44px", { lineHeight: "48px", fontWeight: "600" }],
  kpi: ["44px", { lineHeight: "48px", fontWeight: "600" }],
  "num-lg": ["28px", { lineHeight: "32px", fontWeight: "600" }],
  "num-md": ["17px", { lineHeight: "22px", fontWeight: "600" }],
};

/** Radii (Figma): cards 22, hero card 26, chips pill, buttons 18, small badges 9–12. */
export const radius = {
  card: "22px",
  hero: "26px",
  button: "18px",
  badge: "12px",
  "badge-sm": "9px",
  chip: "9999px",
};

/** Figma effect style Elevation/Card. */
export const shadow = {
  card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -4px rgba(16,24,40,.06)",
  /** Hero card while the line is stopped: soft red glow (Figma 01 Now). */
  "hero-stop": "0 12px 32px -8px rgba(229,36,59,.35)",
};

/** Spacing: 16 page gutter, 12–14 between cards, 16–18 card padding. */
export const spacing = {
  gutter: "16px",
  "card-gap": "12px",
  "card-pad": "16px",
};

/** Motion — only meaningful animation. Durations in seconds. */
export const motion = {
  number: 0.6, // smooth number change
  enter: 0.25, // new item appearing
  pulse: 1.6, // active downtime pulse period
  ease: [0.2, 0, 0, 1] as [number, number, number, number],
};

/** OEE target comes from /api/state (shift.target, 85 %); these are the frontend constants for A/P/Q. */
export const kpiTargets = {
  availability: 0.9,
  performance: 0.95,
  quality: 0.99,
} as const;

/** Below target by up to this much (fraction) → warn; further → crit. */
export const warnBand = 0.02;
