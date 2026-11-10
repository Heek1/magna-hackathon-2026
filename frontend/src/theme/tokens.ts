/**
 * Design tokens — the single source of truth (docs/design-brief.md; names match the Figma variables).
 * Tailwind (tailwind.config.ts) and the ECharts theme (theme/echarts.ts) both read from here.
 * Do not hardcode colors, sizes or shadows anywhere else.
 */

/** Figma: bg/*, text/*, border/*, status/* */
export const palette = {
  bg: {
    canvas: "#F3F4F7", // page background
    card: "#FFFFFF", // cards, tab bar
    subtle: "#F6F7F9", // empty cells, progress tracks, rank badge
    ink: "#0E1116", // hero status card, primary buttons
  },
  text: {
    primary: "#0B0D12", // titles, numbers
    secondary: "#5F6672", // supporting text
    tertiary: "#9AA1AD", // labels, times, inactive tabs
  },
  border: {
    default: "#E6E8EC", // dividers
  },
  status: {
    stop: { DEFAULT: "#E5243B", bg: "#FDECEE" }, // downtime, line stopped, #1 to fix
    defect: { DEFAULT: "#F08A00", bg: "#FFF4E5" }, // scrap / quality
    speed: { DEFAULT: "#2F6BFF", bg: "#EAF0FF" }, // microstops, slowdown, retests
    fix: { DEFAULT: "#0E9F6E", bg: "#E7F6EF" }, // solutions, gains
  },
} as const;

/** Tone of anything that carries meaning: Chip, EventRow, RankRow, PatternGrid… */
export type Tone = "stop" | "defect" | "speed" | "fix" | "neutral";

/**
 * Deprecated: the old dark-theme names, mapped onto the light palette so pages that still use
 * them keep compiling and stay readable. Use `palette` / the new classes in new code.
 */
const legacy = {
  surface: palette.bg.card,
  "surface-2": palette.bg.subtle,
  "border-strong": "#D5D9E0",
  muted: palette.text.secondary,
  dim: palette.text.tertiary,
  accent: palette.status.stop.DEFAULT,
  ok: palette.status.fix.DEFAULT,
  warn: palette.status.defect.DEFAULT,
  crit: palette.status.stop.DEFAULT,
  data: palette.status.speed.DEFAULT,
  "data-2": palette.text.tertiary,
};

/** Flat map for charts and inline styles: colors.canvas, colors.stop, colors["stop-bg"], … */
export const colors = {
  canvas: palette.bg.canvas,
  card: palette.bg.card,
  subtle: palette.bg.subtle,
  ink: palette.bg.ink,
  primary: palette.text.primary,
  secondary: palette.text.secondary,
  tertiary: palette.text.tertiary,
  line: palette.border.default,
  stop: palette.status.stop.DEFAULT,
  "stop-bg": palette.status.stop.bg,
  defect: palette.status.defect.DEFAULT,
  "defect-bg": palette.status.defect.bg,
  speed: palette.status.speed.DEFAULT,
  "speed-bg": palette.status.speed.bg,
  fix: palette.status.fix.DEFAULT,
  "fix-bg": palette.status.fix.bg,
  // deprecated aliases
  bg: palette.bg.canvas,
  text: palette.text.primary,
  border: palette.border.default,
  ...legacy,
} as const;

/** Tailwind color config: bg-bg-card, text-text-secondary, border-border, bg-status-stop-bg, … */
export const tailwindColors = {
  bg: { DEFAULT: palette.bg.canvas, ...palette.bg },
  text: { DEFAULT: palette.text.primary, ...palette.text },
  border: { DEFAULT: palette.border.default, ...palette.border },
  status: palette.status,
  ...legacy,
};

export const fonts = {
  sans: ['"Geist Sans"', "system-ui", "sans-serif"],
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
