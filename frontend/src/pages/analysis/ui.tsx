/** Small pieces used only by the Top errors, Error detail and Fixes screens. */
import type { ReactNode } from "react";
import { ChevronLeft, CircleAlert, RotateCw } from "lucide-react";
import { Card } from "@/components/Card";
import { cn } from "@/lib/utils";
import { toneText, type Tone } from "@/lib/tone";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-overline uppercase text-text-tertiary", className)}>{children}</p>;
}

export function ScreenHeader({ eyebrow, title, right }: { eyebrow: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end gap-3 px-1">
      <div className="min-w-0 flex-1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-0.5 text-display tracking-tight text-text-primary">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function StatCard({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: Tone }) {
  return (
    <Card className="flex-1 !px-3.5 !py-3.5">
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={cn("num text-num-l", tone ? toneText[tone] : "text-text-primary")}>{value}</span>
        {unit && <span className="text-caption text-text-secondary">{unit}</span>}
      </p>
    </Card>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button aria-label="Back to top errors" onClick={onClick} className="grid size-10 place-items-center rounded-full bg-bg-card shadow-card transition active:scale-95">
      <ChevronLeft className="size-5" strokeWidth={2.2} />
    </button>
  );
}

/** Loading skeleton, empty or error card in the screen style. */
export function StateCard({ state, error, onRetry, empty = "Nothing here yet" }: { state: "loading" | "error" | "empty"; error?: string | null; onRetry?: () => void; empty?: string }) {
  if (state === "loading")
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-card bg-bg-card/70 shadow-card" />
        ))}
      </div>
    );
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      {state === "error" && <CircleAlert className="size-6 text-status-stop" />}
      <p className="text-body font-medium">{state === "error" ? "Could not load data" : empty}</p>
      {state === "error" && error && <p className="max-w-[260px] text-caption text-text-secondary">{error}</p>}
      {state === "error" && onRetry && (
        <button onClick={onRetry} className="mt-1 inline-flex items-center gap-1.5 text-caption font-medium text-status-speed">
          <RotateCw className="size-3.5" /> Try again
        </button>
      )}
    </Card>
  );
}
