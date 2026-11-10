import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { toneBorder, type Tone } from "@/lib/tone";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding (16 px). Off for cards whose rows run edge to edge. */
  padded?: boolean;
  /** Colored outline for a highlighted card, e.g. the "Fix first" card uses `stop`. */
  tone?: Tone;
}

/** White card: radius 22, Elevation/Card shadow. Replaces Panel in the mobile screens. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padded = true, tone, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-card bg-bg-card shadow-card",
        padded && "p-card-pad",
        tone && tone !== "neutral" && cn("border-[1.5px]", toneBorder[tone]),
        className,
      )}
      {...props}
    />
  );
});

/** Card header row: title on the left, muted meta (e.g. "6 events") on the right. */
export function CardHeader({ title, meta, className }: { title: string; meta?: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-title-m text-text-primary">{title}</h2>
      {meta && <span className="text-caption text-text-tertiary">{meta}</span>}
    </div>
  );
}
