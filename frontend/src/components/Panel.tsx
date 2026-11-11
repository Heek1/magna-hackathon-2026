import type { ReactNode } from "react";
import { CircleAlert, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

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
  /** Illustration for the empty state, instead of the default icon. */
  emptyArt?: ReactNode;
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
  emptyText,
  errorText,
  onRetry,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-card bg-bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-card-pad">
          {title && <h2 className="text-title-m text-text-primary">{title}</h2>}
          {meta && <span className="text-caption text-text-tertiary">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("relative min-h-0 flex-1 p-card-pad", bodyClassName)}>
        <StateView state={state} emptyText={emptyText} errorText={errorText} onRetry={onRetry}>
          {children}
        </StateView>
      </div>
    </section>
  );
}

/** The four states of a data block, for content that is not wrapped in a Panel. */
export function StateView({
  state,
  emptyText,
  errorText,
  onRetry,
  children,
  emptyArt,
}: Pick<PanelProps, "state" | "emptyText" | "emptyArt" | "errorText" | "onRetry" | "children">) {
  const t = useT();
  if (state === "loading") return <PanelSkeleton />;
  if (state === "empty") return <PanelMessage icon={emptyArt ?? <Inbox className="h-5 w-5" />} text={emptyText ?? t("panel.empty")} />;
  if (state === "error")
    return (
      <PanelMessage
        icon={<CircleAlert className="h-5 w-5 text-crit" />}
        text={errorText ?? t("panel.error")}
        action={
          onRetry && (
            <Button size="sm" onClick={onRetry}>
              <RotateCw className="h-3.5 w-3.5" /> {t("panel.retry")}
            </Button>
          )
        }
      />
    );
  return <>{children}</>;
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
  const t = useT();
  return (
    <div className="flex h-full min-h-24 flex-col gap-3" aria-busy="true" aria-label={t("panel.loading")}>
      <div className="h-4 w-1/3 rounded bg-surface-2" />
      <div className="flex-1 rounded bg-surface-2/60" />
    </div>
  );
}
