import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneBg, toneSolid, toneText, type Tone } from "@/lib/tone";

export interface ChipProps {
  tone?: Tone;
  children: ReactNode;
  /**
   * soft — tinted pill with a dot (default);
   * solid — filled badge, e.g. "#1 Fix first";
   * surface — white pill with the card shadow, e.g. the "Live" indicator.
   */
  variant?: "soft" | "solid" | "surface";
  /** Leading dot in the tone color. Default on for soft and surface. */
  dot?: boolean;
  className?: string;
}

/** Pill with a dot and a label. Color is never the only signal: the label always says it. */
export function Chip({ tone = "neutral", variant = "soft", dot, children, className }: ChipProps) {
  const showDot = dot ?? variant !== "solid";
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip px-2.5 text-caption font-medium",
        variant === "soft" && cn(toneBg[tone], toneText[tone]),
        variant === "solid" && cn(toneSolid[tone], "rounded-badge-sm px-2 text-overline uppercase text-white"),
        variant === "surface" && "bg-bg-card text-text-primary shadow-card",
        className,
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", toneSolid[tone])} aria-hidden />}
      {children}
    </span>
  );
}
