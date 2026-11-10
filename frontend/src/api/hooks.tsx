/**
 * Data layer. Pages and components get data ONLY through these hooks.
 * Stage 1: backed by mocks (src/mocks) and a local simulation clock.
 * Stage 2: same hook signatures, backed by /api/stream and the REST endpoints.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";
import type { Action, ActionStatus, Insight, Loss, SimState } from "@/types/api";
import { mockInsights, mockLosses, mockState } from "@/mocks";
import { parseTime, toIso } from "@/lib/format";

/** Uniform async shape for every hook, so every Panel can show loading / empty / error. */
export interface Resource<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

export const SPEEDS = [1, 10, 60, 300] as const;

interface ClockValue {
  now: Date;
  speed: number;
  paused: boolean;
}
interface ControlValue {
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  jumpTo: (time: Date) => void;
}

interface ActionsValue extends Resource<Action[]> {
  createAction: (insight: Insight) => Promise<Action>;
  updateStatus: (id: string, status: ActionStatus) => Promise<void>;
}

const ActionsCtx = createContext<ActionsValue | null>(null);
const StateCtx = createContext<Resource<SimState> | null>(null);
const ClockCtx = createContext<ClockValue | null>(null);
const ControlCtx = createContext<ControlValue | null>(null);

const TICK_MS = 250;

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SimState>(mockState);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => parseTime(mockState.sim_time));
  const nowRef = useRef(now);
  nowRef.current = now;

  // Local clock: advances sim time by `speed` × real time. In stage 2 it interpolates between SSE events.
  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now();
      const next = new Date(nowRef.current.getTime() + (t - last) * speed);
      last = t;
      setNow(next);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, speed]);

  const jumpTo = useCallback((time: Date) => {
    setNow(time);
    // Mock: data stays the snapshot, only sim_time moves. Stage 2: POST /api/sim/control {jump_to}.
    setState((s) => ({ ...s, sim_time: toIso(time) }));
  }, []);

  const control = useMemo<ControlValue>(() => ({ setPaused, setSpeed, jumpTo }), [jumpTo]);
  const clock = useMemo<ClockValue>(() => ({ now, speed, paused }), [now, speed, paused]);
  const resource = useMemo<Resource<SimState>>(() => ({ data: state, loading: false, error: null }), [state]);

  // Actions (mock: in memory; stage 2: POST /api/actions, PATCH /api/actions/{id}).
  const [actionList, setActionList] = useState<Action[]>([]);
  const createAction = useCallback((insight: Insight) => {
    const action: Action = {
      id: `act-${insight.id}`,
      insight_id: insight.id,
      title: insight.recommendation.action,
      owner: insight.recommendation.owner_role,
      status: "open",
      created_at: toIso(nowRef.current),
    };
    setActionList((list) => (list.some((a) => a.insight_id === insight.id) ? list : [...list, action]));
    return Promise.resolve(action);
  }, []);
  const updateStatus = useCallback((id: string, status: ActionStatus) => {
    setActionList((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    return Promise.resolve();
  }, []);
  const actions = useMemo<ActionsValue>(
    () => ({ data: actionList, loading: false, error: null, createAction, updateStatus }),
    [actionList, createAction, updateStatus],
  );

  return (
    <ControlCtx.Provider value={control}>
      <ActionsCtx.Provider value={actions}>
        <StateCtx.Provider value={resource}>
          <ClockCtx.Provider value={clock}>{children}</ClockCtx.Provider>
        </StateCtx.Provider>
      </ActionsCtx.Provider>
    </ControlCtx.Provider>
  );
}

function useRequired<T>(ctx: Context<T | null>, name: string): T {
  const v = useContext(ctx);
  if (!v) throw new Error(`${name} must be used inside <SimProvider>`);
  return v;
}

/** Current shift state (GET /api/state, then pushed by /api/stream). */
export function useSimState(): Resource<SimState> {
  return useRequired(StateCtx, "useSimState");
}

/** Simulation clock, ticking locally — use for timers and countdowns. */
export function useSimClock(): ClockValue {
  return useRequired(ClockCtx, "useSimClock");
}

/** Pause / speed / jump (POST /api/sim/control). */
export function useSimControl(): ControlValue {
  return useRequired(ControlCtx, "useSimControl");
}

/** GET /api/insights */
export function useInsights(): Resource<Insight[]> {
  return { data: mockInsights, loading: false, error: null };
}

/** GET /api/losses?from&to */
export function useLosses(_params: { from: string; to: string }): Resource<Loss[]> {
  return { data: mockLosses, loading: false, error: null };
}

/** GET/POST /api/actions, PATCH /api/actions/{id} — shared across pages. */
export function useActions(): ActionsValue {
  return useRequired(ActionsCtx, "useActions");
}
