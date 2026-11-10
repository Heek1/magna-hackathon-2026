import { useMemo } from "react";
import { resourceState, useInsights, useLosses, useSimState } from "@/api/hooks";
import { DowntimeBanner } from "@/components/DowntimeBanner";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { LossWaterfall } from "@/components/charts/LossWaterfall";
import { HourlyOutputChart } from "@/components/charts/HourlyOutputChart";
import { kpiTargets } from "@/theme/tokens";
import { pcs } from "@/lib/format";
import { RightRail } from "./RightRail";

export default function LivePage() {
  const live = useSimState();
  const { data: state, error } = live;
  const shift = state?.shift;
  const losses = useLosses(shift ? { from: shift.date, to: shift.date } : null);
  const insights = useInsights();

  const recommendation = useMemo(() => {
    const code = state?.active_downtime?.code;
    return code ? insights.data?.find((i) => i.code === code)?.recommendation?.action : undefined;
  }, [state?.active_downtime?.code, insights.data]);

  const blockState = resourceState(live, (s) => s.shift.plan_min === 0 || s.hours.length === 0);

  return (
    <div className="grid h-full min-h-[900px] grid-cols-[minmax(0,1fr)_440px] grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <div className="col-span-2 row-start-1 empty:hidden">
        <DowntimeBanner downtime={state?.active_downtime ?? null} recommendation={recommendation} />
      </div>

      <div className="col-start-1 row-start-2 grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4">
        {shift && blockState !== "empty" ? (
          <>
            <KpiCard
              label="OEE"
              primary
              value={shift.oee}
              target={shift.target}
              hint={gapHint(shift.ok, shift.plan_min, shift.target)}
            />
            <KpiCard
              label="Availability"
              value={shift.availability}
              target={kpiTargets.availability}
              range={[0.7, 1]}
              hint={`${pcs(shift.downtime_min)} min down`}
            />
            <KpiCard
              label="Performance"
              value={shift.performance}
              target={kpiTargets.performance}
              range={[0.7, 1]}
              hint={`${pcs(shift.produced)} / ${pcs(shift.run_min)} pcs`}
            />
            <KpiCard
              label="Quality"
              value={shift.quality}
              target={kpiTargets.quality}
              range={[0.9, 1]}
              hint={`${pcs(shift.nok)} NOK`}
            />
          </>
        ) : (
          ["OEE", "Availability", "Performance", "Quality"].map((label) => (
            <Panel
              key={label}
              title={label}
              state={blockState}
              errorText={error}
              emptyText="Shift has not started yet"
              className="h-44"
            />
          ))
        )}
      </div>

      <RightRail className="col-start-2 row-span-2 row-start-2 min-h-0" />

      <div className="col-start-1 row-start-3 grid min-h-0 grid-cols-2 gap-4">
        <Panel
          title="Losses this shift"
          meta="pcs · 60 s ideal cycle"
          state={blockState}
          errorText={error}
          emptyText="Shift has not started yet"
          bodyClassName="p-3"
        >
          {shift && <LossWaterfall kpis={shift} losses={losses.data} />}
        </Panel>
        <Panel
          title="Output per hour"
          meta="vs 60 pcs/h"
          state={blockState}
          errorText={error}
          emptyText="Shift has not started yet"
          bodyClassName="p-3"
        >
          {state && (
            <HourlyOutputChart
              hours={state.hours}
              currentHour={state.shift.hour}
              stoppedNow={!!state.active_downtime}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/** OEE in pieces: how many good pieces the shift is short of target so far. */
function gapHint(ok: number, plan: number, target: number): string {
  const gap = target * plan - ok;
  return gap > 0.5 ? `${pcs(gap)} pcs short of target` : `${pcs(ok)} good pcs, on target`;
}
