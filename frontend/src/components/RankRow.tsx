import { motion, useReducedMotion } from "framer-motion";
import { Card } from "@/components/Card";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { pcs } from "@/lib/format";
import { toneSolid, type Tone } from "@/lib/tone";
import { motion as tokens } from "@/theme/tokens";

export interface RankRowProps {
  rank: number;
  /** e.g. "ST-001 · Part unavailable". */
  title: string;
  /** e.g. "7× · Mon–Fri · 60 min". */
  meta: string;
  /** Pieces lost. */
  value: number;
  valueLabel?: string;
  /** Bar width: this loss / loss of #1 (0..1). */
  ratio: number;
  tone?: Tone;
  /** Opens Error detail. */
  onClick?: () => void;
  className?: string;
}

/** Ranked error in its own card: rank badge · title + meta · value · bar scaled to #1. */
export function RankRow({
  rank,
  title,
  meta,
  value,
  valueLabel,
  ratio,
  tone = "stop",
  onClick,
  className,
}: RankRowProps) {
  const reduce = useReducedMotion();
  const t = useT();
  const body = (
    <>
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="num flex h-8 w-8 items-center justify-center rounded-badge-sm bg-bg-subtle text-num-s text-text-secondary">
          {rank}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-body font-medium text-text-primary">{title}</span>
          <span className="block truncate text-caption text-text-secondary">{meta}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="num text-num-m text-text-primary">{pcs(value)}</span>
          <span className="text-caption text-text-tertiary">{valueLabel ?? t("rank.pcsLost")}</span>
        </span>
      </div>
      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
        <motion.div
          className={cn("h-full rounded-full", toneSolid[tone])}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
          transition={{ duration: tokens.number, ease: tokens.ease }}
        />
      </div>
    </>
  );

  return onClick ? (
    <Card className={cn("p-0", className)}>
      <button type="button" onClick={onClick} className="w-full rounded-card p-card-pad text-left hover:bg-bg-subtle/60">
        {body}
      </button>
    </Card>
  ) : (
    <Card className={className}>{body}</Card>
  );
}
