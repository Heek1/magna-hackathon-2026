import { motion, AnimatePresence } from "framer-motion";
import { OctagonAlert } from "lucide-react";
import type { ActiveDowntime } from "@/types/api";
import { useSimClock } from "@/api/hooks";
import { Elapsed } from "@/components/Countdown";
import { hhmm, parseTime } from "@/lib/format";
import { motion as tokens } from "@/theme/tokens";

export interface DowntimeBannerProps {
  downtime: ActiveDowntime | null;
  /** Recommended countermeasure for this code, if an insight has one. */
  recommendation?: string;
}

/**
 * Full-width alarm while the line is stopped — the loudest thing on screen and the only one that pulses.
 * Left: what stopped. Middle: what to do. Right: how long and how much it costs, readable from 3 m.
 */
export function DowntimeBanner({ downtime, recommendation }: DowntimeBannerProps) {
  return (
    <AnimatePresence initial={false}>
      {downtime && (
        <motion.div
          key={downtime.code + downtime.since}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: tokens.enter, ease: tokens.ease }}
          role="alert"
          className="overflow-hidden"
        >
          <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-8 overflow-hidden rounded border border-accent/60 bg-accent/[0.08] py-4 pl-7 pr-6">
            <span className="absolute inset-y-0 left-0 w-1.5 animate-stop-pulse bg-accent" aria-hidden />
            <span className="absolute inset-0 animate-stop-pulse rounded border border-accent" aria-hidden />

            <div className="flex items-center gap-4">
              <OctagonAlert className="h-11 w-11 shrink-0 text-accent" strokeWidth={2} aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="label text-accent">Line stopped</span>
                <span className="flex items-baseline gap-3 leading-none">
                  <span className="num text-num-md font-semibold text-text">{downtime.code}</span>
                  <span className="text-xl font-medium text-text/90">{downtime.device}</span>
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5 border-l border-accent/30 pl-8">
              <p className="truncate text-lg font-medium text-text">{downtime.description}</p>
              {recommendation ? (
                <p className="line-clamp-2 text-sm leading-snug text-muted">
                  <span className="mr-2 font-semibold text-text/90">Do now:</span>
                  {recommendation}
                </p>
              ) : (
                <p className="text-sm text-muted">No countermeasure on file for this code yet.</p>
              )}
            </div>

            <DowntimeStats since={downtime.since} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DowntimeStats({ since }: { since: string }) {
  const { now } = useSimClock();
  const lostPcs = Math.max(0, Math.floor((now.getTime() - parseTime(since).getTime()) / 60000)); // 60 s cycle
  return (
    <div className="flex items-stretch gap-6">
      <div className="flex flex-col items-end justify-between gap-1">
        <span className="label">Stopped since {hhmm(parseTime(since))}</span>
        <Elapsed since={since} className="text-num-lg font-medium leading-none text-text" />
      </div>
      <div className="w-px bg-accent/30" aria-hidden />
      <div className="flex flex-col items-end justify-between gap-1">
        <span className="label">Lost so far</span>
        <span className="num text-num-lg font-medium leading-none text-accent">
          {lostPcs}
          <span className="ml-1.5 text-base font-normal text-muted">pcs</span>
        </span>
      </div>
    </div>
  );
}
