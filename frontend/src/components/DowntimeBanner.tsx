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

/** Full-width alarm while the line is stopped. The only element that pulses. */
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
          <div className="relative flex items-center gap-6 rounded border border-accent bg-accent/10 px-5 py-3">
            <span className="absolute inset-0 animate-stop-pulse rounded border-2 border-accent" aria-hidden />
            <div className="flex items-center gap-3">
              <OctagonAlert className="h-8 w-8 animate-stop-pulse text-accent" strokeWidth={2.25} aria-hidden />
              <div className="flex flex-col">
                <span className="label text-accent">Line stopped</span>
                <span className="text-lg font-semibold">
                  <span className="num">{downtime.code}</span>
                  <span className="mx-2 text-dim">·</span>
                  {downtime.device}
                </span>
              </div>
            </div>
            <p className="min-w-0 flex-1 text-base text-text/90">
              {downtime.description}
              {recommendation && (
                <span className="mt-0.5 block truncate text-sm text-muted">
                  <span className="label mr-2">Do now</span>
                  {recommendation}
                </span>
              )}
            </p>
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
    <div className="flex items-end gap-8">
      <div className="flex flex-col items-end">
        <span className="label">Since {hhmm(parseTime(since))}</span>
        <Elapsed since={since} className="text-num-lg font-medium text-text" />
      </div>
      <div className="flex flex-col items-end">
        <span className="label">Lost</span>
        <span className="num text-num-lg font-medium text-accent">
          {lostPcs}
          <span className="ml-1 text-base text-muted">pcs</span>
        </span>
      </div>
    </div>
  );
}
