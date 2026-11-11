import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Confidence, LineEvent, Loss, SimState, UpcomingStop } from "@/types/api";
import { resourceState, useConnection, useEvents, useLosses, useSimClock, useSimControl, useSimState, useUpcoming, type Resource } from "@/api/hooks";
import { Card, CardHeader } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { CleanLineArt } from "@/components/CleanLineArt";
import { EventRow } from "@/components/EventRow";
import { OeeRing } from "@/components/OeeRing";
import { OeeSparkline } from "@/components/OeeSparkline";
import { StateView } from "@/components/Panel";
import { PieceGrid } from "@/components/PieceGrid";
import { ShiftStrip } from "@/components/ShiftStrip";
import { SimSettings } from "@/components/SimSettings";
import { AskAiButton } from "@/components/ask/AskAiButton";
import { StatusHero } from "@/components/StatusHero";
import { dayLabel, greeting, hhmm, parseTime, pcs, weekdayShort } from "@/lib/format";
import { useT, type TKey } from "@/lib/i18n";
import { CalendarClock, ChevronDown, TrendingUp } from "lucide-react";
import { roleInfo, useRole } from "@/lib/role";
import { RolePicker } from "@/components/RolePicker";
import { toneBg, toneText, type Tone } from "@/lib/tone";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

/** 01 Now — what is happening on the line and when. */
export default function NowPage() {
  const live = useSimState();
  const state = live.data;
  const { now } = useSimClock();
  const events = useEvents(state?.shift.date ?? null);
  // Month to date: the countermeasure for whatever is stopped now.
  const losses = useLosses(state ? { to: state.shift.date } : null);
  const navigate = useNavigate();
  const open = (code: string) => navigate(`/errors/${encodeURIComponent(code)}`);

  return (
    <div className="flex flex-col gap-card-gap pb-4">
      <Header date={state ? now : null} />
      {state ? (
        <Hero state={state} events={events.data ?? []} losses={losses.data ?? []} onOpen={open} />
      ) : (
        <Card className="min-h-[188px] rounded-hero">
          <StateView state={resourceState(live)} errorText={live.error} />
        </Card>
      )}
      {state ? (
        <Kpis state={state} losses={losses.data} onOpen={open} />
      ) : (
        <div className="grid grid-cols-2 gap-card-gap">
          {[0, 1].map((i) => (
            <Card key={i} className="min-h-[96px]">
              <StateView state={live.error ? "error" : "loading"} errorText={live.error ? "No data" : null} />
            </Card>
          ))}
        </div>
      )}
      <ComingUp waiting={!state} onOpen={open} />
      <ErrorsToday events={events} waiting={!state} onOpen={open} />
    </div>
  );
}

function Header({ date }: { date: Date | null }) {
  const t = useT();
  const connection = useConnection();
  const { paused } = useSimClock();
  const { setPaused } = useSimControl();
  // Live chip doubles as pause/resume: one tap stops the clock while the judges ask questions.
  const chip =
    connection === "live" ? (
      <button
        type="button"
        onClick={() => setPaused(!paused)}
        aria-label={t(paused ? "sim.resumeSim" : "sim.pauseSim")}
        className="relative transition before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] active:scale-95"
      >
        <Chip tone={paused ? "defect" : "fix"} variant="surface">
          {t(paused ? "status.paused" : "status.live")}
        </Chip>
      </button>
    ) : connection === "lost" ? (
      <Chip tone="stop" variant="surface">{t("status.offline")}</Chip>
    ) : (
      <Chip variant="surface">{t("status.connecting")}</Chip>
    );
  return (
    <header className="flex items-start justify-between gap-3 pt-2">
      <div className="min-w-0">
        <p className="overline-label">{t("brand.line")}{date && ` · ${dayLabel(date)}`}</p>
        <h1 className="mt-1 text-display text-text-primary">{date ? greeting(date) : t("greet.hello")}</h1>
        <RoleButton />
      </div>
      <div className="mt-[22px] flex items-center gap-2">
        {chip}
        <AskAiButton />
        <SimSettings className="lg:hidden" />
      </div>
    </header>
  );
}

function Hero({
  state,
  events,
  losses,
  onOpen,
}: {
  state: SimState;
  events: LineEvent[];
  losses: Loss[];
  onOpen: (code: string) => void;
}) {
  const t = useT();
  const stop = state.active_downtime;
  if (stop) {
    const fix = losses.find((l) => l.code === stop.code)?.fix?.action;
    return (
      <StatusHero
        state="stopped"
        title={stop.description}
        subtitle={`${stop.code} · ${stop.device}`}
        since={stop.since}
        fix={fix}
        onFixClick={() => onOpen(stop.code)}
      />
    );
  }
  const lastStop = events.find((e) => e.kind === "stop");
  return (
    <StatusHero
      state="running"
      oee={state.shift.oee}
      subtitle={lastStop ? t("hero.lastStop", { code: lastStop.code, time: hhmm(parseTime(lastStop.time)) }) : t("hero.noStops")}
    />
  );
}

function Kpis({ state, losses, onOpen }: { state: SimState; losses?: Loss[]; onOpen: (code: string) => void }) {
  const t = useT();
  const { shift, hours } = state;
  const desktop = useIsDesktop();
  const worked = hours.filter((h) => h.plan_min > 0); // the first minutes of a shift have no plan yet
  const lost = Math.max(0, shift.plan_min - shift.ok); // ideal (1 pc / planned min) − good
  return (
    <>
      <Card className="flex items-center justify-between gap-4">
        <OeeRing value={shift.oee} target={shift.target} />
        {worked.length > 0 && (
          <div className="min-w-0 flex-1 text-right">
            <span className="overline-label">{t("kpi.byHour")}</span>
            <OeeSparkline className="ml-auto mt-1 h-12 w-full max-w-[200px]" values={worked.map((h) => h.oee)} target={shift.target} />
          </div>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-card-gap">
        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="overline-label">{t("kpi.lost")}</span>
            <span className="shrink-0 whitespace-nowrap text-caption text-text-secondary">{t("kpi.of", { n: pcs(Math.round(shift.plan_min)) })}</span>
          </div>
          <span className="flex items-baseline gap-1">
            <span className="num text-num-l text-text-primary">{pcs(Math.round(lost))}</span>
            <span className="text-body text-text-secondary">{t("unit.pcs")}</span>
          </span>
          <PieceGrid
            total={shift.plan_min}
            stop={shift.downtime_min}
            speed={Math.max(0, shift.run_min - shift.produced)}
            defect={shift.nok}
            columns={desktop ? 32 : 16}
          />
        </Card>
        <IfFixedFirst losses={losses} onOpen={onOpen} />
      </div>
    </>
  );
}

/** The OEE that comes back if the biggest stop so far is fixed first. */
function IfFixedFirst({ losses, onOpen }: { losses?: Loss[]; onOpen: (code: string) => void }) {
  const t = useT();
  const top = useMemo(
    () => (losses ?? []).filter((l) => l.type === "downtime").sort((a, b) => b.loss_pcs - a.loss_pcs)[0],
    [losses],
  );
  return (
    <Card padded={false} className="bg-status-fix-bg">
      <button
        type="button"
        disabled={!top}
        onClick={() => top && onOpen(top.code)}
        className="flex h-full w-full flex-col justify-between gap-3 rounded-card p-card-pad text-left"
      >
        <span className="overline-label text-text-secondary">{t("kpi.ifFixed")}</span>
        {top ? (
          <>
            <span>
              <span className="flex items-center gap-2 text-status-fix">
                <TrendingUp className="h-6 w-6 shrink-0" aria-hidden />
                <span className="num text-num-l">+{top.loss_pp.toFixed(2)}</span>
              </span>
              <span className="mt-0.5 block text-caption text-text-secondary">{t("unit.pp")} OEE · {top.code}</span>
            </span>
            <Chip tone="fix" variant="surface" dot={false} className="w-fit">
              {t("kpi.back", { n: pcs(Math.round(top.loss_pcs)) })}
            </Chip>
          </>
        ) : (
          <span className="text-caption text-text-secondary">{t("kpi.noStops")}</span>
        )}
      </button>
    </Card>
  );
}

const kindLabel = { stop: "kind.stop", defect: "kind.defect", speed: "kind.speed" } as const;

function ErrorsToday({
  events,
  waiting,
  onOpen,
}: {
  events: Resource<LineEvent[]>;
  /** No line state yet, so the day is not known. */
  waiting: boolean;
  onOpen: (code: string) => void;
}) {
  const t = useT();
  const sorted = useMemo(() => [...(events.data ?? [])].sort((a, b) => b.time.localeCompare(a.time)), [events.data]);
  // A running stop counts up with the sim clock, like the hero timer, between data refreshes.
  const { now } = useSimClock();
  return (
    <Card>
      <CardHeader
        title={t("errors.title")}
        meta={events.data ? t.count("events", sorted.length) : undefined}
      />
      <div className="mt-1">
        <StateView
          state={waiting ? "loading" : resourceState(events)}
          emptyText={t("errors.empty")}
          emptyArt={<CleanLineArt className="h-16 w-28" />}
          errorText={events.error}
        >
          <ShiftStrip className="mb-1 mt-2" events={sorted} now={now} />
          {sorted.map((e) => (
            <EventRow
              key={`${e.time}-${e.code}`}
              time={e.time}
              kind={e.kind}
              title={e.title}
              subtitle={`${t(kindLabel[e.kind])} · ${e.active ? t("errors.running") : e.detail}`}
              value={e.active ? liveMinutes(e.time, now) : e.value}
              unit={e.unit}
              onClick={() => onOpen(e.code)}
            />
          ))}
        </StateView>
      </div>
    </Card>
  );
}

/** 48 h of shift time (06:00–14:00 on working days) = the next 6 shifts. */
const HORIZON_H = 48;
const confidenceTone: Record<Confidence, Tone> = { high: "stop", medium: "defect", low: "neutral" };
const confidenceText: Record<Confidence, TKey> = { high: "conf.high", medium: "conf.medium", low: "conf.low" };

/** "In 22 h 48 min", "In 35 min", "Now" — calendar time until the expected stop. */
function untilText(ms: number, t: ReturnType<typeof useT>): string {
  if (ms <= 60_000) return t("until.now");
  const min = Math.round(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? t("until.hm", { h, m: min % 60 }) : t("until.m", { m: min });
}

/** Stops the engine expects next (GET /api/upcoming): the line is warned before it stops. */
function ComingUp({ waiting, onOpen }: { waiting: boolean; onOpen: (code: string) => void }) {
  const t = useT();
  const upcoming = useUpcoming(HORIZON_H);
  const { now } = useSimClock();
  const items = (upcoming.data ?? []).slice(0, 3);

  return (
    <Card>
      <CardHeader title={t("coming.title")} meta={t("coming.meta")} />
      <div className="mt-1">
        <StateView
          state={waiting ? "loading" : resourceState(upcoming)}
          emptyText={t("coming.empty")}
          errorText={upcoming.error}
        >
          {items.map((u, i) => (
            <UpcomingRow key={`${u.code}-${u.expected_at}`} item={u} countdown={i === 0 ? untilText(parseTime(u.expected_at).getTime() - now.getTime(), t) : null} onClick={() => onOpen(u.code)} />
          ))}
        </StateView>
      </div>
    </Card>
  );
}

function UpcomingRow({ item, countdown, onClick }: { item: UpcomingStop; countdown: string | null; onClick: () => void }) {
  const t = useT();
  const at = parseTime(item.expected_at);
  const tone = confidenceTone[item.confidence];
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 grid min-h-[64px] w-[calc(100%+16px)] grid-cols-[44px_28px_minmax(0,1fr)_auto] items-center gap-3 rounded-badge px-2 py-2.5 text-left hover:bg-bg-subtle"
    >
      <span className="flex flex-col leading-tight">
        <span className="text-caption text-text-tertiary">{weekdayShort(at)}</span>
        <span className="num text-num-s text-text-primary">{hhmm(at)}</span>
      </span>
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-badge-sm", toneBg[tone], toneText[tone])}>
        <CalendarClock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-text-primary">
          {item.code} · {item.title}
        </span>
        <span className="block truncate text-caption text-text-secondary">
          <span className={cn("font-medium", toneText[tone])}>{countdown ?? t(confidenceText[item.confidence])}</span>
          {" · "}
          {item.evidence}
        </span>
      </span>
      <span className={cn("num whitespace-nowrap text-num-m", toneText[tone])}>~{Math.round(item.risk_pcs)} {t("unit.pcs")}</span>
    </button>
  );
}

/** "Maintenance ▾" under the greeting: who you are, tap to change. */
function RoleButton() {
  const t = useT();
  const [role, setRole] = useRole();
  const [open, setOpen] = useState(false);
  const info = roleInfo(role);
  if (!info) return null;
  const Icon = info.icon;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative mt-2 inline-flex h-8 items-center gap-1.5 rounded-chip bg-bg-card pl-2.5 pr-2 text-caption font-medium text-text-primary shadow-card transition before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] active:scale-95"
        aria-label={t("role.viewingAs", { role: t(`role.${info.role}`) })}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {t(`role.${info.role}`)}
        <ChevronDown className="h-4 w-4 text-text-tertiary" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg-canvas">
          <RolePicker
            current={role}
            onClose={() => setOpen(false)}
            onPick={(r) => {
              setRole(r);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

/** Whole minutes from the stop start to the (smoothed) sim clock. */
function liveMinutes(start: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - parseTime(start).getTime()) / 60_000));
}
