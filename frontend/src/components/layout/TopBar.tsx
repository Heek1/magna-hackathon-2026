import { useConnection, useSimClock, useSimControl, useSimState } from "@/api/hooks";
import { SimControls } from "@/components/layout/SimControls";
import { ShiftIndicator } from "@/components/layout/ShiftIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { dayLabel, hhmmss } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header: simulation time, controls, shift indicator, line status. */
export function TopBar({ title }: { title: string }) {
  const { now, paused, speed } = useSimClock();
  const { data } = useSimState();
  const connection = useConnection();
  const { error: controlError } = useSimControl();
  const stopped = !!data?.active_downtime;

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-6 border-b bg-bg px-6">
      <h1 className="w-28 text-xl font-semibold tracking-tight">{title}</h1>
      <Divider />

      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="label">Simulation</span>
          <span className="num text-sm text-muted">{data ? dayLabel(now) : "—"}</span>
        </div>
        <span className="num text-[32px] font-medium leading-none tracking-tight text-text">
          {data ? hhmmss(now) : "--:--:--"}
        </span>
        <span
          className={cn(
            "num rounded border px-1.5 py-0.5 text-xs",
            paused ? "border-warn/50 text-warn" : "border-border-strong text-muted",
          )}
        >
          {paused ? "Paused" : `${speed}×`}
        </span>
      </div>
      <Divider />

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

function Divider() {
  return <span className="h-9 w-px bg-border" aria-hidden />;
}
