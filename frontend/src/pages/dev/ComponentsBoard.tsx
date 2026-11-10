/**
 * Dev-only board of the shared components (the code twin of the Figma "Components" board, node 2:3).
 * Served at /components in `npm run dev` only; not part of the production build.
 * Data comes from the dumped backend mocks so every component shows real shapes.
 */
import { useState } from "react";
import { ChartColumn, Clock, Plus, SquareCheck } from "lucide-react";
import type { ErrorDetail, LineEvent, Loss } from "@/types/api";
import events from "@/mocks/events.json";
import errorSt038 from "@/mocks/error_ST-038.json";
import losses from "@/mocks/losses.json";
import { BottomBar } from "@/components/BottomBar";
import { Card, CardHeader } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { EventRow } from "@/components/EventRow";
import { OeeRing } from "@/components/OeeRing";
import { PatternGrid } from "@/components/PatternGrid";
import { RankRow } from "@/components/RankRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusHero } from "@/components/StatusHero";
import { TabBar } from "@/components/TabBar";
import { lossTone } from "@/lib/tone";

const ev = events as LineEvent[];
const detail = errorSt038 as ErrorDetail;
const stops = (losses as Loss[]).filter((l) => l.type === "downtime");

export default function ComponentsBoard() {
  const [segment, setSegment] = useState<"stops" | "defects" | "speed">("stops");
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-card-gap px-gutter pb-28 pt-6">
      <p className="overline-label">Components · dev board</p>

      <Section title="Chip">
        <div className="flex flex-wrap gap-2">
          <Chip tone="stop">Stop</Chip>
          <Chip tone="defect">Defect</Chip>
          <Chip tone="speed">Speed</Chip>
          <Chip tone="fix">+0.98 pp OEE</Chip>
          <Chip>Maintenance</Chip>
          <Chip tone="stop" variant="solid">#1 Fix first</Chip>
          <Chip tone="fix" variant="surface">Live</Chip>
        </div>
      </Section>

      <Section title="StatusHero">
        <StatusHero
          state="stopped"
          title="Camera light module"
          subtitle="ST-038 · Vision station"
          since="2026-11-25T09:08:00"
          fix="Clean camera, check lighting"
          onFixClick={() => undefined}
        />
        <StatusHero state="running" oee={0.812} since="2026-11-25T09:33:00" subtitle="Last stop ST-038 · 25 min" />
      </Section>

      <Section title="OeeRing">
        <div className="grid grid-cols-2 gap-card-gap">
          <Card>
            <OeeRing value={0.764} target={0.85} />
          </Card>
          <Card>
            <OeeRing value={0.862} target={0.85} />
          </Card>
        </div>
      </Section>

      <Section title="EventRow">
        <Card>
          <CardHeader title="Errors today" meta={`${ev.length} events`} />
          <div className="mt-1 divide-y">
            {ev.slice(0, 4).map((e) => (
              <EventRow
                key={e.time + e.code}
                time={e.time}
                kind={e.kind}
                title={e.title}
                subtitle={e.detail}
                value={e.value}
                unit={e.unit}
                onClick={() => undefined}
              />
            ))}
          </div>
        </Card>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          label="Error type"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "stops", label: "Stops" },
            { value: "defects", label: "Defects" },
            { value: "speed", label: "Speed" },
          ]}
        />
      </Section>

      <Section title="RankRow">
        {stops.slice(1, 4).map((l, i) => (
          <RankRow
            key={l.code}
            rank={i + 2}
            title={`${l.code} · ${l.description}`}
            meta={`${l.count}× · ${l.device}`}
            value={l.loss_pcs}
            ratio={l.loss_pcs / stops[0].loss_pcs}
            tone={lossTone[l.type]}
            onClick={() => undefined}
          />
        ))}
      </Section>

      <Section title="PatternGrid">
        <Card>
          <CardHeader title="When it happens" meta="Nov 2–25" />
          <PatternGrid className="mt-3" cells={detail.pattern} tone="stop" />
        </Card>
      </Section>

      <Section title="BottomBar">
        <BottomBar label="Create action for Maintenance" icon={Plus} onClick={() => undefined} className="static mx-0 px-0" />
      </Section>

      <Section title="TabBar">
        <TabBar
            className="static rounded-card"
            items={[
              { to: "/", label: "Now", icon: Clock },
              { to: "/errors", label: "Top errors", icon: ChartColumn },
              { to: "/fixes", label: "Fixes", icon: SquareCheck },
            ]}
          />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-card-gap pt-3">
      <h2 className="text-title-m text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}
