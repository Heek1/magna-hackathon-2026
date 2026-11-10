import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Confidence, LineEvent, Loss, SimState, UpcomingStop } from "@/types/api";
import { resourceState, useConnection, useEvents, useLosses, useSimClock, useSimState, useUpcoming, type Resource } from "@/api/hooks";
import { Card, CardHeader } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { EventRow } from "@/components/EventRow";
import { OeeRing } from "@/components/OeeRing";
import { StateView } from "@/components/Panel";
import { SimSettings } from "@/components/SimSettings";
import { AskAiButton } from "@/components/ask/AskAiButton";
import { StatusHero } from "@/components/StatusHero";
import { dayLabel, greeting, hhmm, parseTime, pcs } from "@/lib/format";
import { CalendarClock, ChevronDown } from "lucide-react";
import { roleInfo, useRole } from "@/lib/role";
import { RolePicker } from "@/components/RolePicker";
import { toneBg, toneText, type Tone } from "@/lib/tone";
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
        <Kpis state={state} />
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
  const connection = useConnection();
  const chip =
    connection === "live" ? (
      <Chip tone="fix" variant="surface">Live</Chip>
    ) : connection === "lost" ? (
      <Chip tone="stop" variant="surface">Offline</Chip>
    ) : (
      <Chip variant="surface">Connecting</Chip>
    );
  return (
    <header className="flex items-start justify-between gap-3 pt-2">
      <div className="min-w-0">
        <p className="overline-label">Line L01{date && ` · ${dayLabel(date)}`}</p>
        <h1 className="mt-1 text-display text-text-primary">{date ? greeting(date) : "Hello"}</h1>
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
      subtitle={lastStop ? `Last stop ${lastStop.code} at ${hhmm(parseTime(lastStop.time))}` : "No stops so far today"}
    />
  );
}

function Kpis({ state }: { state: SimState }) {
  const { shift } = state;
  const lost = Math.max(0, shift.plan_min - shift.ok); // ideal (1 pc / planned min) − good
  return (
    <div className="grid grid-cols-2 gap-card-gap">
      <Card>
        <OeeRing value={shift.oee} target={shift.target} />
      </Card>
      <Card className="flex flex-col justify-center">
        <span className="overline-label">Lost today</span>
        <span className="mt-0.5 flex items-baseline gap-1">
          <span className="num text-num-l text-text-primary">{pcs(Math.round(lost))}</span>
          <span className="text-body text-text-secondary">pcs</span>
        </span>
        <span className="text-caption text-text-secondary">of {pcs(Math.round(shift.plan_min))} possible</span>
      </Card>
    </div>
  );
}

const kindLabel = { stop: "Stop", defect: "Defect", speed: "Speed loss" } as const;

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
  const sorted = useMemo(() => [...(events.data ?? [])].sort((a, b) => b.time.localeCompare(a.time)), [events.data]);
  // A running stop counts up with the sim clock, like the hero timer, between data refreshes.
  const { now } = useSimClock();
  return (
    <Card>
      <CardHeader
        title="Errors today"
        meta={events.data ? `${sorted.length} ${sorted.length === 1 ? "event" : "events"}` : undefined}
      />
      <div className="mt-1">
        <StateView
          state={waiting ? "loading" : resourceState(events)}
          emptyText="No errors so far today — the line runs clean."
          errorText={events.error}
        >
          {sorted.map((e) => (
            <EventRow
              key={`${e.time}-${e.code}`}
              time={e.time}
              kind={e.kind}
              title={e.title}
              subtitle={`${kindLabel[e.kind]} · ${e.active ? "still running" : e.detail}`}
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
const confidenceText: Record<Confidence, string> = { high: "High confidence", medium: "Likely", low: "Possible" };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "In 22 h 48 min", "In 35 min", "Now" — calendar time until the expected stop. */
function untilText(ms: number): string {
  if (ms <= 60_000) return "Now";
  const min = Math.round(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? `In ${h} h ${min % 60} min` : `In ${min} min`;
}

/** Stops the engine expects next (GET /api/upcoming): the line is warned before it stops. */
function ComingUp({ waiting, onOpen }: { waiting: boolean; onOpen: (code: string) => void }) {
  const upcoming = useUpcoming(HORIZON_H);
  const { now } = useSimClock();
  const items = (upcoming.data ?? []).slice(0, 3);

  return (
    <Card>
      <CardHeader title="Coming up" meta="next 6 shifts" />
      <div className="mt-1">
        <StateView
          state={waiting ? "loading" : resourceState(upcoming)}
          emptyText="No repeating stops expected — nothing to prepare for."
          errorText={upcoming.error}
        >
          {items.map((u, i) => (
            <UpcomingRow key={`${u.code}-${u.expected_at}`} item={u} countdown={i === 0 ? untilText(parseTime(u.expected_at).getTime() - now.getTime()) : null} onClick={() => onOpen(u.code)} />
          ))}
        </StateView>
      </div>
    </Card>
  );
}

function UpcomingRow({ item, countdown, onClick }: { item: UpcomingStop; countdown: string | null; onClick: () => void }) {
  const at = parseTime(item.expected_at);
  const tone = confidenceTone[item.confidence];
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 grid min-h-[64px] w-[calc(100%+16px)] grid-cols-[44px_28px_minmax(0,1fr)_auto] items-center gap-3 rounded-badge px-2 py-2.5 text-left hover:bg-bg-subtle"
    >
      <span className="flex flex-col leading-tight">
        <span className="text-caption text-text-tertiary">{WEEKDAY[at.getDay()]}</span>
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
          <span className={cn("font-medium", toneText[tone])}>{countdown ?? confidenceText[item.confidence]}</span>
          {" · "}
          {item.evidence}
        </span>
      </span>
      <span className={cn("num whitespace-nowrap text-num-m", toneText[tone])}>~{Math.round(item.risk_pcs)} pcs</span>
    </button>
  );
}

/** "Maintenance ▾" under the greeting: who you are, tap to change. */
function RoleButton() {
  const [role, setRole] = useRole();
  const [open, setOpen] = useState(false);
  const info = roleInfo(role);
  if (!info) return null;
  const Icon = info.icon;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-chip bg-bg-card pl-2.5 pr-2 text-caption font-medium text-text-primary shadow-card transition active:scale-95"
        aria-label={`Viewing as ${info.role}. Change role`}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {info.role}
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
