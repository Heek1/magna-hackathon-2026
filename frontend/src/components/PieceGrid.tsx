import { cn } from "@/lib/utils";
import { toneSolid, type Tone } from "@/lib/tone";

export interface PieceGridProps {
  /** Pieces possible so far (1 per planned minute). */
  total: number;
  /** Pieces lost, by cause. */
  stop: number;
  speed: number;
  defect: number;
  columns?: number;
  /** Squares drawn. Fixed, so the card keeps its size as the shift goes on. */
  cells?: number;
  className?: string;
}

/**
 * The shift's possible output as a grid of squares: the share lost to stops, speed and scrap,
 * the rest good. A cause with any loss always gets at least one square.
 */
export function PieceGrid({ total, stop, speed, defect, columns = 16, cells = 160, className }: PieceGridProps) {
  if (total <= 0) return null;
  const share = (v: number) => (v > 0 ? Math.max(1, Math.round((v / total) * cells)) : 0);
  const s = share(stop);
  const sp = share(speed);
  const d = share(defect);
  const squares: Tone[] = Array.from({ length: cells }, (_, i) =>
    i < s ? "stop" : i < s + sp ? "speed" : i < s + sp + d ? "defect" : "fix",
  );
  return (
    <div
      role="img"
      aria-label={`${Math.round(total)} possible pieces: ${Math.round(stop)} lost to stops, ${Math.round(speed)} to speed, ${Math.round(defect)} scrapped`}
      className={cn("grid gap-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {squares.map((tone, i) => (
        <span
          key={i}
          className={cn("aspect-square rounded-[2px] transition-colors duration-500", toneSolid[tone], tone === "fix" && "opacity-30")}
        />
      ))}
    </div>
  );
}
