import { Gauge, Square, TriangleAlert, type LucideIcon } from "lucide-react";
import type { EventKind } from "@/types/api";
import { cn } from "@/lib/utils";
import { hhmm, parseTime, withUnit } from "@/lib/format";
import { kindTone, toneBg, toneText } from "@/lib/tone";

const kindIcon: Record<EventKind, LucideIcon> = { stop: Square, defect: TriangleAlert, speed: Gauge };

export interface EventRowProps {
  /** Contract datetime of the event. */
  time: string;
  kind: EventKind;
  title: string;
  /** e.g. "Stop · still running", "Defect · 1 piece scrapped". */
  subtitle: string;
  value: number;
  unit: string;
  /** Opens Error detail. Without it the row is static. */
  onClick?: () => void;
  className?: string;
}

/** One line of "Errors today": time · tinted icon · title + subtitle · value in the tone color. */
export function EventRow({ time, kind, title, subtitle, value, unit, onClick, className }: EventRowProps) {
  const tone = kindTone[kind];
  const Icon = kindIcon[kind];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "grid min-h-[64px] w-full grid-cols-[44px_28px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left",
        onClick && "-mx-2 rounded-badge px-2 hover:bg-bg-subtle",
        className,
      )}
    >
      <span className="num text-num-s text-text-tertiary">{hhmm(parseTime(time))}</span>
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-badge-sm", toneBg[tone], toneText[tone])}>
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-text-primary">{title}</span>
        <span className="block truncate text-caption text-text-secondary">{subtitle}</span>
      </span>
      <span className={cn("num whitespace-nowrap text-num-m", toneText[tone])}>{withUnit(value, unit)}</span>
    </Tag>
  );
}
