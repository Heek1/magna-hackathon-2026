import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BottomBarProps {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Replaces the default primary button, e.g. a "Created" confirmation. */
  children?: ReactNode;
  className?: string;
}

/**
 * Sticky bottom bar with one primary action, e.g. "Create action for Maintenance" on Error detail.
 * Sits above the phone's home indicator (safe-area inset).
 */
export function BottomBar({ label, onClick, icon: Icon, disabled, children, className }: BottomBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-gutter border-t bg-bg-canvas px-gutter pb-[max(16px,env(safe-area-inset-bottom))] pt-3",
        className,
      )}
    >
      {children ?? (
        <Button variant="primary" size="lg" className="w-full" onClick={onClick} disabled={disabled}>
          {Icon && <Icon className="h-5 w-5" aria-hidden />}
          {label}
        </Button>
      )}
    </div>
  );
}
