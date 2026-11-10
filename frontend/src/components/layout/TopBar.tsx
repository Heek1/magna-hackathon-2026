import { useConnection, useSimClock, useSimControl, useSimState } from "@/api/hooks";
import { SimControls } from "@/components/layout/SimControls";
import { ShiftIndicator } from "@/components/layout/ShiftIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { dayLabel, hhmmss } from "@/lib/format";

/** Header: simulation time, controls, shift indicator, line status. */
export function TopBar({ title }: { title: string }) {
  const { now, paused, speed } = useSimClock();
  const { data } = useSimState();
  const connection = useConnection();
  const { error: controlError } = useSimControl();
  const stopped = !!data?.active_downtime;

  return (
    <header className="flex h-16 shrink-0 items-center gap-8 border-b bg-bg px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>

      <div className="flex items-baseline gap-3">
        <span className="label">Sim time</span>
        <span className="num text-sm text-muted">{data ? dayLabel(now) : ""}</span>
        <span className="num text-num-md font-medium text-text">{data ? hhmmss(now) : "--:--:--"}</span>
        <span className="label text-dim">{paused ? "Paused" : `${speed}×`}</span>
      </div>

      <ShiftIndicator />

      <div className="ml-auto flex items-center gap-6">
        {controlError && (
          <span className="max-w-64 truncate text-xs text-crit" title={controlError}>
            {controlError}
          </span>
        )}
        {connection === "lost" ? (
          <StatusBadge status="warn" size="md">
            {data ? "Reconnecting" : "Backend offline"}
          </StatusBadge>
        ) : (
          data && (
            <StatusBadge status={stopped ? "crit" : "ok"} size="md">
              {stopped ? "Line stopped" : "Running"}
            </StatusBadge>
          )
        )}
        <SimControls />
      </div>
    </header>
  );
}
