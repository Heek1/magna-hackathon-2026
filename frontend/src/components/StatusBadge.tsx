import { CircleCheck, TriangleAlert, OctagonAlert, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/status";

const config: Record<Status, { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: "text-ok border-ok/40" },
  warn: { icon: TriangleAlert, className: "text-warn border-warn/40" },
  crit: { icon: OctagonAlert, className: "text-crit border-crit/50 bg-crit/10" },
  neutral: { icon: Minus, className: "text-muted border-border-strong" },
};

export interface StatusBadgeProps {
  status: Status;
  /** Always pass text: color is never the only signal. */
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** Status pill: color + icon + text, always together. */
export function StatusBadge({ status, children, size = "sm", className }: StatusBadgeProps) {
  const { icon: Icon, className: tone } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-medium uppercase",
        size === "sm" ? "h-6 px-2 text-label" : "h-7 px-2.5 text-xs tracking-wider",
        tone,
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.25} aria-hidden />
      <span className="num tracking-normal">{children}</span>
    </span>
  );
}
