import type { Weekday } from "@/types/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toneSolid, type Tone } from "@/lib/tone";

export interface PatternCell {
  weekday: Weekday;
  hour: number;
  count: number;
}

export interface PatternGridProps {
  /** Cells with occurrences; missing cells are empty. */
  cells: PatternCell[];
  tone?: Tone;
  days?: Weekday[];
  /** Shift hours by clock hour (06 … 13). */
  hours?: number[];
  className?: string;
}

const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Weekday × hour grid of when an error happens. Hot cells take the tone color, stronger with
 * more occurrences; a weekday with any hit is shown in primary text.
 */
export function PatternGrid({ cells, tone = "stop", days = DAYS, hours = HOURS, className }: PatternGridProps) {
  const t = useT();
  const counts = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div
      role="table"
      aria-label={t("pattern.aria")}
      className={cn("grid gap-1", className)}
      style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(0, 1fr))` }}
    >
      <span role="columnheader" />
      {hours.map((h) => (
        <span key={h} role="columnheader" className="num pb-1 text-center text-num-s text-text-tertiary">
          {pad(h)}
        </span>
      ))}
      {days.map((d) => {
        const hot = hours.some((h) => counts.get(`${d}-${h}`));
        return (
          <div key={d} role="row" className="contents">
            <span
              role="rowheader"
              className={cn("flex items-center text-caption", hot ? "font-semibold text-text-primary" : "text-text-tertiary")}
            >
              {t(`day.${d}`)}
            </span>
            {hours.map((h) => {
              const n = counts.get(`${d}-${h}`) ?? 0;
              return (
                <span
                  key={h}
                  role="cell"
                  aria-label={n ? `${d} ${pad(h)}:00 — ${n}×` : undefined}
                  title={n ? `${n}×` : undefined}
                  className={cn("h-6 rounded-badge-sm", n ? toneSolid[tone] : "bg-bg-subtle")}
                  style={n ? { opacity: 0.35 + 0.65 * (n / max) } : undefined}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
