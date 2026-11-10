import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import { pct, ppDelta } from "@/lib/format";
import { statusVsTarget } from "@/lib/status";
import { colors, motion as tokens, type Tone } from "@/theme/tokens";
import { toneText } from "@/lib/tone";

export interface OeeRingProps {
  /** Fraction 0..1. */
  value: number;
  /** Fraction 0..1 (85 % for OEE). */
  target: number;
  label?: string;
  /** Ring diameter in px. */
  size?: number;
  className?: string;
}

const statusTone = { ok: "fix", warn: "defect", crit: "stop", neutral: "neutral" } as const satisfies Record<string, Tone>;
const ringColor: Record<Tone, string> = {
  fix: colors.fix,
  defect: colors.defect,
  stop: colors.stop,
  speed: colors.speed,
  neutral: colors.tertiary,
};
const fmt = (n: number) => pct(n, 1);

/** Small ring + OEE value + delta to target in pp. Ring and delta take the status tone. */
export function OeeRing({ value, target, label = "OEE", size = 48, className }: OeeRingProps) {
  const reduce = useReducedMotion();
  const tone = statusTone[statusVsTarget(value, target)];
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, value));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.subtle} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - filled) }}
          transition={{ duration: tokens.number, ease: tokens.ease }}
        />
      </svg>
      <div className="flex min-w-0 flex-col">
        <span className="overline-label">{label}</span>
        <span className="num text-num-l text-text-primary">
          <AnimatedNumber value={value} format={fmt} />
          <span className="text-title-m">%</span>
        </span>
        <span className={cn("num text-num-s", toneText[tone])}>{ppDelta(value, target)}</span>
      </div>
    </div>
  );
}
