import { useMemo } from "react";
import { useInsights, useLosses, useSimState } from "@/api/hooks";
import { DowntimeBanner } from "@/components/DowntimeBanner";
import { KpiCard } from "@/components/KpiCard";
import { Panel } from "@/components/Panel";
import { LossWaterfall } from "@/components/charts/LossWaterfall";
import { HourlyOutputChart } from "@/components/charts/HourlyOutputChart";
import { kpiTargets } from "@/theme/tokens";
import { InsightFeed } from "./InsightFeed";

export default function LivePage() {
  const { data: state, loading, error } = useSimState();
  const shift = state?.shift;
  const losses = useLosses({ from: shift?.date ?? "", to: shift?.date ?? "" });
  const insights = useInsights();

  const recommendation = useMemo(() => {
    const code = state?.active_downtime?.code;
    return code ? insights.data?.find((i) => i.code === code)?.recommendation.action : undefined;
  }, [state?.active_downtime?.code, insights.data]);

  const blockState = error ? "error" : loading || !shift ? "loading" : shift.plan_min === 0 ? "empty" : "ready";

  return (
    <div className="grid h-full min-h-[900px] grid-cols-[minmax(0,1fr)_440px] grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <div className="col-span-2 empty:hidden">
        <DowntimeBanner downtime={state?.active_downtime ?? null} recommendation={recommendation} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {shift ? (
          <>
            <KpiCard
              label="OEE"
              primary
              value={shift.oee}
              target={shift.target}
              hint={`${shift.ok} of ${shift.plan_min} pcs`}
            />
            <KpiCard
              label="Availability"
              value={shift.availability}
              target={kpiTargets.availability}
              hint={`${shift.downtime_min} min down`}
            />
            <KpiCard
              label="Performance"
              value={shift.performance}
              target={kpiTargets.performance}
              hint={`${shift.produced} / ${shift.run_min} pcs`}
            />
            <KpiCard
              label="Quality"
              value={shift.quality}
              target={kpiTargets.quality}
              hint={`${shift.nok} NOK`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Panel key={i} state={error ? "error" : "loading"} className="h-44" />)
        )}
      </div>

      <InsightFeed className="row-span-2 min-h-0" />

      <div className="grid min-h-0 grid-cols-2 gap-4">
        <Panel
          title="Losses this shift"
          meta="pcs · 60 s ideal cycle"
          state={blockState}
          errorText={error}
          bodyClassName="p-3"
        >
          {shift && <LossWaterfall kpis={shift} losses={losses.data} />}
        </Panel>
        <Panel title="Output per hour" meta="vs 60 pcs/h" state={blockState} errorText={error} bodyClassName="p-3">
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
