import type { ReactNode } from "react";
import { CircleAlert, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PanelState = "ready" | "loading" | "empty" | "error";

export interface PanelProps {
  title?: ReactNode;
  /** Small muted text right after the title, e.g. the period. */
  meta?: ReactNode;
  /** Controls in the header, right-aligned (switches, buttons). */
  actions?: ReactNode;
  /** Every data block handles all four states. Default "ready". */
  state?: PanelState;
  emptyText?: string;
  errorText?: string | null;
  onRetry?: () => void;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** Surface for every block: thin border, no shadow, uppercase muted title. */
export function Panel({
  title,
  meta,
  actions,
  state = "ready",
  emptyText = "No data for this period",
  errorText,
  onRetry,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded border bg-surface", className)}>
      {(title || actions) && (
        <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
          {title && <h2 className="label text-text/80">{title}</h2>}
          {meta && <span className="label text-dim">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("relative min-h-0 flex-1 p-4", bodyClassName)}>
        {state === "ready" && children}
        {state === "loading" && <PanelSkeleton />}
        {state === "empty" && (
          <PanelMessage icon={<Inbox className="h-5 w-5" />} text={emptyText} />
        )}
        {state === "error" && (
          <PanelMessage
            icon={<CircleAlert className="h-5 w-5 text-crit" />}
            text={errorText ?? "Could not load data"}
            action={
              onRetry && (
                <Button size="sm" onClick={onRetry}>
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </Button>
              )
            }
          />
        )}
      </div>
    </section>
  );
}

function PanelMessage({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 text-center text-muted">
      {icon}
      <p className="text-sm">{text}</p>
      {action}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex h-full min-h-24 flex-col gap-3" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-1/3 rounded bg-surface-2" />
      <div className="flex-1 rounded bg-surface-2/60" />
    </div>
  );
}
