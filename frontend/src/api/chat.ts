/**
 * "Ask AI": POST /api/chat and GET /api/chat/suggestions.
 * Without an LLM key the backend answers 503 and the feature hides itself (no button at all).
 */
import { useEffect, useState } from "react";
import { ApiError, api, qs } from "@/api/client";
import { useSimState } from "@/api/hooks";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatReply {
  answer: string;
  /** Short labels of the facts used, e.g. "ST-038 · 4 stops". */
  sources: string[];
  /** 2–3 next questions the user can tap. */
  followups: string[];
}

export interface AskInput {
  question: string;
  /** Earlier turns; the backend uses the last 6. */
  history?: ChatTurn[];
  /** The error on screen (Error detail). */
  code?: string | null;
  /** The user's role, e.g. "Maintenance". */
  role?: string | null;
}

/** The backend allows 10 s for the LLM; give the request a little more before giving up. */
const ASK_TIMEOUT_MS = 15_000;

export async function askAi({ question, history = [], code, role }: AskInput): Promise<ChatReply> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ASK_TIMEOUT_MS);
  try {
    const reply = await api<ChatReply>("/chat", {
      method: "POST",
      json: { question, history: history.slice(-6), code: code ?? null, role: role ?? null },
      signal: ctrl.signal,
    });
    return { answer: reply.answer ?? "", sources: reply.sources ?? [], followups: reply.followups ?? [] };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError(504, "The AI took too long to answer");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatSuggestions {
  /** null while checking; false when the AI is not available (503) — then show nothing. */
  available: boolean | null;
  suggestions: string[];
}

// One request per screen, role and simulated day. A new day (a jump in the simulation) asks again,
// which also makes the backend answer the starter questions for that day in the background.
// A 503 (no LLM key) is remembered; any other failure is tried again the next time a screen asks.
const cache = new Map<string, Promise<string[] | null>>();

function loadSuggestions(code: string | null, role: string | null, day: string): Promise<string[] | null> {
  const key = `${code ?? ""}|${role ?? ""}|${day}`;
  let request = cache.get(key);
  if (!request) {
    request = api<string[]>(`/chat/suggestions${qs({ code, role })}`).catch((e) => {
      if (!(e instanceof ApiError && e.status === 503)) cache.delete(key);
      return null;
    });
    cache.set(key, request);
  }
  return request;
}

/** Starter questions for this screen and role; `available: false` hides the feature. */
export function useChatSuggestions(code: string | null = null, role: string | null = null): ChatSuggestions {
  const [state, setState] = useState<ChatSuggestions>({ available: null, suggestions: [] });
  const day = useSimState().data?.shift.date ?? "";
  useEffect(() => {
    let alive = true;
    loadSuggestions(code, role, day).then((list) => {
      // Keep what is shown while a new day loads; only a definite answer changes it.
      if (alive) setState(list ? { available: true, suggestions: list } : { available: false, suggestions: [] });
    });
    return () => {
      alive = false;
    };
  }, [code, role, day]);
  return state;
}
