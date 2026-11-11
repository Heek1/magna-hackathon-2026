import { useSimClock } from "@/api/hooks";
import { cn } from "@/lib/utils";

/**
 * A strip of parts on a belt along the hero card: moving while the line runs (and the simulation is not paused), frozen and red
 * while it is stopped. Decorative; the state is also written in the card.
 */
export function Conveyor({ stopped, className }: { stopped: boolean; className?: string }) {
  const { paused } = useSimClock();
  return (
    <div aria-hidden className={cn("relative h-2 overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <span
        className={cn(
          "conveyor-parts absolute inset-y-0 -left-6 right-0",
          stopped ? "text-status-stop" : "text-status-fix",
          !stopped && !paused && "conveyor-moving",
        )}
      />
    </div>
  );
}
