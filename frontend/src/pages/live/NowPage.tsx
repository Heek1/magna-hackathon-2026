import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { LineEvent, Loss, SimState } from "@/types/api";
import { useConnection, useEvents, useLosses, useSimClock, useSimState } from "@/api/hooks";
import { Card, CardHeader } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { EventRow } from "@/components/EventRow";
import { OeeRing } from "@/components/OeeRing";
import { StatusHero } from "@/components/StatusHero";
import { dayLabel, greeting, hhmm, parseTime, pcs } from "@/lib/format";

/** 01 Now — what is happening on the line and when. */
export default function NowPage() {
  const { data: state } = useSimState();
  const { now } = useSimClock();
  const events = useEvents(state?.shift.date);
  // Month to date: the countermeasure for whatever is stopped now.
  const losses = useLosses(state ? { to: state.shift.date } : null);
  const navigate = useNavigate();
  const open = (code: string) => navigate(`/errors/${encodeURIComponent(code)}`);

  return (
    <div className="flex flex-col gap-card-gap pb-4">
      <Header date={state ? now : null} />
      {state && <Hero state={state} events={events.data ?? []} losses={losses.data ?? []} onOpen={open} />}
      {state && <Kpis state={state} />}
      <ErrorsToday events={events.data ?? []} onOpen={open} />
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
    <header className="flex items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        <p className="overline-label">Line L01{date && ` · ${dayLabel(date)}`}</p>
        <h1 className="mt-1 text-display text-text-primary">{date ? greeting(date) : "Hello"}</h1>
      </div>
      <div className="pb-1.5">{chip}</div>
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

function ErrorsToday({ events, onOpen }: { events: LineEvent[]; onOpen: (code: string) => void }) {
  const sorted = useMemo(() => [...events].sort((a, b) => b.time.localeCompare(a.time)), [events]);
  return (
    <Card>
      <CardHeader title="Errors today" meta={`${sorted.length} ${sorted.length === 1 ? "event" : "events"}`} />
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-body text-text-secondary">No errors so far today.</p>
      ) : (
        <div className="mt-1">
          {sorted.map((e) => (
            <EventRow
              key={`${e.time}-${e.code}`}
              time={e.time}
              kind={e.kind}
              title={e.title}
              subtitle={`${kindLabel[e.kind]} · ${e.active ? "still running" : e.detail}`}
              value={e.value}
              unit={e.unit}
              onClick={() => onOpen(e.code)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
