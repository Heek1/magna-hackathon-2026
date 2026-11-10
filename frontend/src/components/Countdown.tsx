import { useSimClock } from "@/api/hooks";
import { duration, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CountdownProps {
  /** Contract datetime to count down to. */
  to: string;
  className?: string;
  /** Text when the moment has passed. */
  dueText?: string;
}

/** Countdown in simulation time (follows pause / speed / jump). */
export function Countdown({ to, className, dueText = "due now" }: CountdownProps) {
  const { now } = useSimClock();
  const left = parseTime(to).getTime() - now.getTime();
  return (
    <span className={cn("num", className)} aria-live="off">
      {left > 0 ? duration(left) : dueText}
    </span>
  );
}

/** Elapsed time since a moment, in simulation time. */
export function Elapsed({ since, className }: { since: string; className?: string }) {
  const { now } = useSimClock();
  return <span className={cn("num", className)}>{duration(now.getTime() - parseTime(since).getTime())}</span>;
}
