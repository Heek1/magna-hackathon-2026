/** Thin fetch wrapper for the backend. All paths are relative to /api (proxied by Vite to :8000). */

export const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "Backend is not reachable");
  }
  if (!res.ok) {
    let detail =
      res.status >= 500 ? `Server error (${res.status}) — is the backend running?` : `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not JSON */
    }
    if (res.status === 401) toAccessPage();
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

/** Query string from defined params: {from: "2026-11-02", to: undefined} → "?from=2026-11-02" */
export function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * The demo is behind an access key (server cookie). If the cookie is missing, e.g. the app was opened
 * from the phone's cache, go to the server's "Access required" page instead of showing empty screens.
 */
function toAccessPage() {
  if (typeof window === "undefined" || window.location.search.includes("locked=1")) return;
  window.location.replace("/?locked=1");
}
