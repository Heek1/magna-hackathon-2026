import { ChevronRight, Wrench } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Conveyor } from "@/components/Conveyor";
import { Elapsed } from "@/components/Countdown";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { hhmm, parseTime, pct } from "@/lib/format";

interface StoppedProps {
  state: "stopped";
  /** Short error name, e.g. "Camera light module". */
  title: string;
  /** e.g. "ST-038 · Vision station". */
  subtitle: string;
  /** Contract datetime the stop began — the timer counts from it in simulation time. */
  since: string;
  /** Recommended fix for this code; the row is hidden when there is none. */
  fix?: string | null;
  onFixClick?: () => void;
}

interface RunningProps {
  state: "running";
  title?: string;
  subtitle?: string;
  /** Shift OEE so far, fraction 0..1. */
  oee: number;
  /** Shift start or last stop end, shown as "since 06:00". */
  since?: string;
}

export type StatusHeroProps = (StoppedProps | RunningProps) & { className?: string };

const fmtPct = (n: number) => pct(n, 1);

/**
 * The one dark card on the Now screen: live line status.
 * Stopped — red pill, error name, live timer, recommended fix row. Running — calm green variant with shift OEE.
 */
export function StatusHero(props: StatusHeroProps) {
  const t = useT();
  const stopped = props.state === "stopped";
  return (
    <section
      aria-live="polite"
      className={cn(
        "rounded-hero bg-bg-ink p-5 text-white",
        stopped ? "shadow-hero-stop" : "shadow-card",
        props.className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-[26px] items-center gap-1.5 rounded-chip px-2.5 text-overline uppercase",
            stopped ? "bg-status-stop/20 text-status-stop" : "bg-status-fix/20 text-status-fix",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", stopped ? "animate-stop-pulse bg-status-stop" : "bg-status-fix")}
            aria-hidden
          />
          {t(stopped ? "hero.stopped" : "hero.running")}
        </span>
        {props.since && <span className="text-caption text-text-tertiary">{t("hero.since", { time: hhmm(parseTime(props.since)) })}</span>}
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {/* Long names (the data has full sentences) drop to Title M so the timer keeps its room. */}
          <h2 className={cn("text-white", (props.title?.length ?? 0) > 24 ? "text-title-m" : "text-title-l")}>
            {props.title ?? t("hero.allRunning")}
          </h2>
          {(props.subtitle ?? !stopped) && (
            <p className="mt-0.5 text-body text-text-tertiary">{props.subtitle ?? t("hero.noStopNow")}</p>
          )}
        </div>
        {stopped ? (
          <Elapsed since={props.since} className="shrink-0 text-num-hero text-status-stop" />
        ) : (
          <span className="num shrink-0 text-right">
            <span className="block text-overline uppercase text-text-tertiary">{t("hero.shiftOee")}</span>
            <span className="text-num-hero text-white">
              <AnimatedNumber value={props.oee} format={fmtPct} />
              <span className="text-num-l">%</span>
            </span>
          </span>
        )}
      </div>

      {stopped && props.fix && <FixRow fix={props.fix} onClick={props.onFixClick} />}
      <Conveyor stopped={stopped} className="mt-4" />
    </section>
  );
}

function FixRow({ fix, onClick }: { fix: string; onClick?: () => void }) {
  const t = useT();
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="mt-4 flex w-full items-center gap-3 rounded-button border border-white/10 bg-white/[0.06] px-3.5 py-3 text-left"
    >
      <Wrench className="h-5 w-5 shrink-0 text-status-fix" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-text-tertiary">{t("hero.fix")}</span>
        <span className="line-clamp-2 text-body font-medium text-white">{fix}</span>
      </span>
      {onClick && <ChevronRight className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden />}
    </Tag>
  );
}
