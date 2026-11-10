/**
 * Data layer. Pages and components get data ONLY through these hooks.
 * Live state comes from /api/stream (SSE); everything else from the REST endpoints and is
 * refetched as simulation time moves (throttled), so every page shows data up to sim_time.
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
import type {
  Action,
  ActionCreate,
  ActionStatus,
  HeatmapCell,
  HeatmapMetric,
  HistoryPoint,
  Insight,
  LineEvent,
  Loss,
  SimControl,
  SimControlState,
  SimState,
  WhatIfRequest,
  WhatIfResponse,
} from "@/types/api";
import { API_BASE, ApiError, api, errorText, qs } from "@/api/client";
import { parseTime, toIso } from "@/lib/format";
import type { PanelState } from "@/components/Panel";
// Stage 4 of the mobile redesign builds the Now screen on mocks; stage 5 switches to /api/events.
import eventsMock from "@/mocks/events.json";

/** Uniform async shape for every hook, so every Panel can show loading / empty / error. */
export interface Resource<T> {
  /** Last good data — kept while refetching and after a failed refetch. */
  data: T | undefined;
  /** True only until the first response. */
  loading: boolean;
  error: string | null;
}

/** Panel state for a resource: error/loading only while there is nothing to show. */
export function resourceState<T>(r: Resource<T>, isEmpty?: (data: T) => boolean): PanelState {
  if (r.data === undefined) return r.error ? "error" : "loading";
  if (isEmpty ? isEmpty(r.data) : Array.isArray(r.data) && r.data.length === 0) return "empty";
  return "ready";
}

/** Simulator speed multipliers; backend default is 60 (1 real second = 1 simulated minute). */
export const SPEEDS = [1, 10, 60, 120, 300] as const;

export type Connection = "connecting" | "live" | "lost";

interface ClockValue {
  now: Date;
  speed: number;
  paused: boolean;
}
interface ControlValue {
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  jumpTo: (time: Date) => void;
  error: string | null;
}
interface ActionsValue extends Resource<Action[]> {
  /** From an insight (title, owner and link taken from it) or from explicit fields. */
  createAction: (from: Insight | ActionCreate) => Promise<Action>;
  updateStatus: (id: number, status: ActionStatus) => Promise<void>;
}
interface LiveValue {
  state: Resource<SimState>;
  connection: Connection;
  /** Bumps (throttled) when sim_time moves; REST hooks refetch on it. */
  refreshKey: number;
}

const LiveCtx = createContext<LiveValue | null>(null);
const ClockCtx = createContext<ClockValue | null>(null);
const ControlCtx = createContext<ControlValue | null>(null);
const ActionsCtx = createContext<ActionsValue | null>(null);
const InsightsCtx = createContext<Resource<Insight[]> | null>(null);

const TICK_MS = 250;
/** REST data is refetched at most this often while the simulation runs. */
const REFRESH_MS = 3000;
/** Never extrapolate the clock further than this past the last server event. */
const MAX_EXTRAPOLATE_MS = 1500;

export function SimProvider({ children }: { children: ReactNode }) {
  // ---- live state (SSE) ----
  const [state, setState] = useState<SimState>();
  const [stateError, setStateError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [refreshKey, setRefreshKey] = useState(0);
  const lastRefresh = useRef(0);
  const lastHourKey = useRef("");

  // ---- clock ----
  const [speed, setSpeedState] = useState(60);
  const [paused, setPausedState] = useState(false);
  const [now, setNow] = useState(() => new Date(0));
  const anchor = useRef({ sim: 0, real: 0 });

  const bumpRefresh = useCallback(() => {
    lastRefresh.current = performance.now();
    setRefreshKey((k) => k + 1);
  }, []);

  const applyState = useCallback(
    (s: SimState) => {
      setState(s);
      setStateError(null);
      const sim = parseTime(s.sim_time).getTime();
      anchor.current = { sim, real: performance.now() };
      setNow(new Date(sim));
      // Refetch REST data when the hour or day changes, otherwise at most every REFRESH_MS.
      const hourKey = `${s.shift.date}-${s.shift.hour}`;
      if (hourKey !== lastHourKey.current || performance.now() - lastRefresh.current > REFRESH_MS) {
        lastHourKey.current = hourKey;
        bumpRefresh();
      }
    },
    [bumpRefresh],
  );

  const applyControl = useCallback((c: SimControlState) => {
    setSpeedState(c.speed);
    setPausedState(c.paused);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    api<SimState>("/state", { signal: ctrl.signal })
      .then(applyState)
      .catch((e) => e.name !== "AbortError" && setStateError(errorText(e)));
    // Empty control call = read the current speed / paused without changing them.
    api<SimControlState>("/sim/control", { method: "POST", json: {}, signal: ctrl.signal })
      .then(applyControl)
      .catch(() => undefined);

    // EventSource retries network drops by itself, but gives up on an HTTP error
    // (e.g. the dev proxy answering 500 while the backend is down) — then we reconnect ourselves.
    let es: EventSource | null = null;
    let retry: number | undefined;
    const connect = () => {
      es = new EventSource(`${API_BASE}/stream`);
      es.addEventListener("state", (e) => {
        setConnection("live");
        applyState(JSON.parse((e as MessageEvent).data));
      });
      es.onerror = () => {
        setConnection("lost");
        if (es?.readyState === EventSource.CLOSED) retry = window.setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      ctrl.abort();
      window.clearTimeout(retry);
      es?.close();
    };
  }, [applyState, applyControl]);

  // Smooth clock between server events (the server ticks once per real second).
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const { sim, real } = anchor.current;
      if (!real) return;
      const elapsed = Math.min(performance.now() - real, MAX_EXTRAPOLATE_MS);
      setNow(new Date(sim + elapsed * speed));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, speed]);

  // ---- controls ----
  const [controlError, setControlError] = useState<string | null>(null);
  const sendControl = useCallback(
    (body: SimControl) => {
      api<SimControlState>("/sim/control", { method: "POST", json: body })
        .then((c) => {
          setControlError(null);
          applyControl(c);
          const sim = parseTime(c.sim_time).getTime();
          anchor.current = { sim, real: performance.now() };
          setNow(new Date(sim));
          if (body.jump_to) bumpRefresh();
        })
        .catch((e) => setControlError(errorText(e)));
    },
    [applyControl, bumpRefresh],
  );
  const control = useMemo<ControlValue>(
    () => ({
      setPaused: (p) => {
        setPausedState(p);
        sendControl({ paused: p });
      },
      setSpeed: (s) => {
        setSpeedState(s);
        sendControl({ speed: s });
      },
      jumpTo: (t) => sendControl({ jump_to: toIso(t) }),
      error: controlError,
    }),
    [sendControl, controlError],
  );

  // ---- actions (shared by Live and Actions pages) ----
  const [actionList, setActionList] = useState<Action[]>();
  const [actionsError, setActionsError] = useState<string | null>(null);
  const actionsLoaded = actionList !== undefined;
  useEffect(() => {
    if (actionsLoaded) return; // loaded once; afterwards kept in sync by our own mutations
    const ctrl = new AbortController();
    api<Action[]>("/actions", { signal: ctrl.signal })
      .then((a) => {
        setActionList(a);
        setActionsError(null);
      })
      .catch((e) => e.name !== "AbortError" && setActionsError(errorText(e)));
    return () => ctrl.abort();
  }, [actionsLoaded, refreshKey]);

  const createAction = useCallback(async (from: Insight | ActionCreate) => {
    const body: ActionCreate =
      "kind" in from
        ? {
            title: from.recommendation?.action ?? from.title,
            insight_id: from.id,
            owner: from.recommendation?.owner_role ?? null,
            status: "open",
          }
        : from;
    const created = await api<Action>("/actions", { method: "POST", json: body });
    setActionList((list) => [...(list ?? []), created]);
    return created;
  }, []);

  const actionsRef = useRef(actionList);
  actionsRef.current = actionList;
  const updateStatus = useCallback(async (id: number, status: ActionStatus) => {
    const before = actionsRef.current;
    setActionList(before?.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const updated = await api<Action>(`/actions/${id}`, { method: "PATCH", json: { status } });
      setActionList((list) => list?.map((a) => (a.id === id ? updated : a)));
      setActionsError(null);
    } catch (e) {
      setActionList(before);
      setActionsError(errorText(e));
      throw e;
    }
  }, []);

  // ---- insights: one shared request for every consumer ----
  const insights = useFetch<Insight[]>("/insights", refreshKey);

  // ---- context values ----
  const live = useMemo<LiveValue>(
    () => ({
      state: {
        data: state,
        loading: !state && !stateError,
        error: stateError ?? (connection === "lost" && !state ? "Backend is not reachable" : null),
      },
      connection,
      refreshKey,
    }),
    [state, stateError, connection, refreshKey],
  );
  const clock = useMemo<ClockValue>(() => ({ now, speed, paused }), [now, speed, paused]);
  const actions = useMemo<ActionsValue>(
    () => ({
      data: actionList,
      loading: !actionList && !actionsError,
      error: actionsError,
      createAction,
      updateStatus,
    }),
    [actionList, actionsError, createAction, updateStatus],
  );

  return (
    <ControlCtx.Provider value={control}>
      <ActionsCtx.Provider value={actions}>
        <LiveCtx.Provider value={live}>
          <InsightsCtx.Provider value={insights}>
            <ClockCtx.Provider value={clock}>{children}</ClockCtx.Provider>
          </InsightsCtx.Provider>
        </LiveCtx.Provider>
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
  return useRequired(LiveCtx, "useSimState").state;
}

/** SSE connection status for the header. */
export function useConnection(): Connection {
  return useRequired(LiveCtx, "useConnection").connection;
}

/** Simulation clock, smoothed locally between server events — use for timers and countdowns. */
export function useSimClock(): ClockValue {
  return useRequired(ClockCtx, "useSimClock");
}

/** Pause / speed / jump (POST /api/sim/control). */
export function useSimControl(): ControlValue {
  return useRequired(ControlCtx, "useSimControl");
}

/** GET/POST /api/actions, PATCH /api/actions/{id} — shared across pages. */
export function useActions(): ActionsValue {
  return useRequired(ActionsCtx, "useActions");
}

/** GET a path, refetched when sim_time moves. `path = null` skips the request. */
function useApi<T>(path: string | null): Resource<T> {
  return useFetch<T>(path, useRequired(LiveCtx, "useApi").refreshKey);
}

function useFetch<T>(path: string | null, refreshKey: number): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const loadedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (loadedPath.current !== path) {
      // New query: drop the previous one's data so the panel shows loading, not wrong numbers.
      loadedPath.current = path;
      setData(undefined);
      setError(null);
    }
    const ctrl = new AbortController();
    api<T>(path, { signal: ctrl.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => e.name !== "AbortError" && setError(errorText(e)));
    return () => ctrl.abort();
  }, [path, refreshKey]);

  return useMemo(
    () => ({ data: path ? data : undefined, loading: !!path && data === undefined && !error, error }),
    [path, data, error],
  );
}

/** GET /api/events?date — today's events up to sim_time, newest first. */
export function useEvents(_date?: string): Resource<LineEvent[]> {
  return { data: eventsMock as LineEvent[], loading: false, error: null };
}

/** GET /api/insights — shared, fetched once per refresh for the whole app. */
export function useInsights(): Resource<Insight[]> {
  return useRequired(InsightsCtx, "useInsights");
}

type Period = { from?: string; to?: string };

/** GET /api/losses?from&to (dates optional — omitted = everything up to sim_time). `null` skips. */
export function useLosses(params: Period | null): Resource<Loss[]> {
  return useApi<Loss[]>(params ? `/losses${qs(params)}` : null);
}

/** GET /api/history?from&to */
export function useHistory(params: Period | null): Resource<HistoryPoint[]> {
  return useApi<HistoryPoint[]>(params ? `/history${qs(params)}` : null);
}

/** GET /api/heatmap?metric */
export function useHeatmap(metric: HeatmapMetric): Resource<HeatmapCell[]> {
  return useApi<HeatmapCell[]>(`/heatmap${qs({ metric })}`);
}

/** POST /api/whatif, re-run (debounced) whenever the request changes. `null` = nothing selected. */
export function useWhatIf(req: WhatIfRequest | null): Resource<WhatIfResponse> & { pending: boolean } {
  const [data, setData] = useState<WhatIfResponse>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const key = req ? JSON.stringify(req) : null;

  useEffect(() => {
    if (!key) {
      setData(undefined);
      setError(null);
      setPending(false);
      return;
    }
    const ctrl = new AbortController();
    setPending(true);
    const t = window.setTimeout(() => {
      api<WhatIfResponse>("/whatif", { method: "POST", json: JSON.parse(key), signal: ctrl.signal })
        .then((d) => {
          setData(d);
          setError(null);
          setPending(false);
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          setError(errorText(e));
          setPending(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [key]);

  return { data, loading: pending && data === undefined, error, pending };
}

/**
 * Chat. `available`: null while probing, false when /api/chat answers 503 (no LLM key) —
 * the chat panel is then hidden. Without a key the backend answers 503 before calling the LLM.
 */
let chatProbe: Promise<boolean> | null = null;
function probeChat(): Promise<boolean> {
  chatProbe ??= api<{ answer: string }>("/chat", { method: "POST", json: { question: "" } })
    .then(() => true)
    .catch((e) => {
      // 503 = no LLM key: stays hidden. Anything else (backend down…): hidden now, probe again later.
      if (!(e instanceof ApiError && e.status === 503 && !e.message.startsWith("Server error"))) chatProbe = null;
      return false;
    });
  return chatProbe;
}

export function useChat() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const connection = useConnection();
  useEffect(() => {
    let alive = true;
    probeChat().then((ok) => alive && setAvailable(ok)); // re-probed when the backend comes back
    return () => {
      alive = false;
    };
  }, [connection]);

  const ask = useCallback(async (question: string) => {
    try {
      return (await api<{ answer: string }>("/chat", { method: "POST", json: { question } })).answer;
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setAvailable(false);
      throw e;
    }
  }, []);

  return { available, ask };
}
