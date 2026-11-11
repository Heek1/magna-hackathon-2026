"""chat: answers questions with an LLM, strictly from a compact snapshot of the data.

chat(question, data, history, code, role, actions) -> {answer, sources, followups}
suggestions(data, code, role) -> 3-4 starter questions
warm_up(data, role) -> answers the starter questions in the background, into the cache
Both chat and suggestions raise ChatUnavailable without GEMINI_API_KEY; chat also when the LLM
fails or takes longer than TIMEOUT_S. The API turns ChatUnavailable into 503.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

import httpx
import pandas as pd

from .common import WEEKDAYS, normalize
from . import engine as _engine
from .engine import _load_countermeasures, get_insights
from . import fallback
from . import lang as _lang
from .explain import explain
from .upcoming import upcoming
from .whatif import SPEED_COLUMNS, what_if

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# 3.6 Flash with minimal thinking answered the demo questions in ~2 s; 3.5 Flash-Lite is the
# fallback (its own quota) when the first is busy or slow.
# Free tier: gemini-3.6-flash allows only 20 requests per day per project (seen in its 429), which
# the warm-up alone uses up; 3.5 Flash-Lite answers the demo questions correctly in 1-3 s and has a
# far larger daily allowance, so it goes first and 3.6 Flash is the fallback.
DEFAULT_MODEL = "gemini-3.5-flash-lite"      # override with GEMINI_MODEL
FALLBACK_MODEL = "gemini-3.6-flash"          # override with GEMINI_FALLBACK_MODEL ("" = none)
KEY_ENV = ("GEMINI_API_KEY", "GEMINI_API_KEY_2")  # the second key is optional; use another project
TIMEOUT_S = 7.0     # the whole LLM part, both models included; then an engine-data answer or 503.
                    # 7 s keeps the typing dots in the app under 8 s with the network and snapshot.
HEDGE_S = 2.5       # the fallback starts alongside a primary that has not answered by then
MAX_OUTPUT_TOKENS = 256  # a 60-word answer + sources + followups is ~180 tokens
CACHE_TTL_S = 600
CACHE_MAX = 256
HISTORY_TURNS = 6
MAX_TEXT = 600          # characters kept per history turn
MAX_SOURCES = 4
MAX_FOLLOWUPS = 3

SYSTEM = (
    "You are the AI assistant of the OEE Improvement Engine for an electric drive assembly line "
    "(10 stations, ideal cycle 60 s, shift 06:00-14:00, OEE target 85 %). The last message holds a "
    "JSON snapshot of the line data and one question.\n"
    "Rules:\n"
    "1. Answer ONLY the question asked, from the snapshot only. If focus is set, the question is "
    "about it unless it says otherwise.\n"
    "2. Every number must be copied from the snapshot as written (percentages, minutes, pieces, pp, "
    "times, dates). Never calculate, round or estimate a new number; for gains use the gains or "
    "gain_if_fixed entries.\n"
    "3. Mention a countermeasure only for the codes your answer is about. Never add fixes, codes or "
    "facts the question did not ask about.\n"
    "4. If the snapshot does not answer the question, say what the data shows and stop.\n"
    "5. Write plain words with units (\"121 min of downtime\", \"87 pcs\", \"81.9 %\"), never the "
    "JSON field names. 1 lost piece = 1 planned minute; pp = OEE percentage points. For upcoming "
    "stops use their \"when\" label.\n"
    "6. Talk to the user as their assistant (\"you\"); never write as the user or as their role. If "
    "role is set and you name fixes, the ones owned by that role come first.\n"
    "7. At most 60 words, plain text without markdown, in the answer language named in the last message.\n"
    "Return JSON: answer; sources: 1-4 short labels in plain words (at most 5 words, no field names) "
    "of the snapshot facts you used, e.g. \"ST-038 · 4 stops\", \"OEE by weekday\", \"Gain if fixed\"; followups: 2-3 short next questions the user "
    "could tap, in the answer language, answerable from the snapshot."
)

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "answer": {"type": "STRING"},
        "sources": {"type": "ARRAY", "items": {"type": "STRING"}},
        "followups": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["answer", "sources", "followups"],
}

STATIONS = {"Kamera": "Camera", "Nastroj": "Tool", "Zasobovanie": "Part supply"}
WEEKDAY_WORDS = {name.lower(): n for n, name in enumerate(WEEKDAYS)}

log = logging.getLogger("oee.chat")
if not log.handlers:  # uvicorn does not configure app loggers; timings must reach the hosting log
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s %(message)s"))
    log.addHandler(_handler)
    log.setLevel(logging.INFO)
    log.propagate = False


class ChatUnavailable(RuntimeError):
    """No LLM key, or the LLM failed or timed out; the API turns this into 503."""


class QuotaExceeded(ChatUnavailable):
    """HTTP 429 from the LLM: a rate limit of this key's project for this model."""

    def __init__(self, message: str, quota: str = "", limit: str = "", retry_s: float = 0.0):
        super().__init__(message)
        self.quota, self.limit, self.retry_s = quota, limit, retry_s


def _keys() -> list[str]:
    """The configured keys in order: GEMINI_API_KEY, then GEMINI_API_KEY_2 if set."""
    keys = []
    for name in KEY_ENV:
        value = os.environ.get(name, "").strip()
        if value and value not in keys:
            keys.append(value)
    return keys


def _key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise ChatUnavailable("GEMINI_API_KEY is not set")
    return key


# ---------- snapshot ----------

def _pct(part: float, whole: float) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def _kpis(hours) -> dict:
    plan, ok = float(hours["Plan_min"].sum()), float(hours["OK_ks"].sum())
    return {"oee_pct": _pct(ok, plan), "lost_pcs": round(plan - ok, 1),
            "downtime_min": round(float(hours["Prestoj_min"].sum()), 1),
            "nok": round(float(hours["NOK_ks"].sum()), 1)}


def _by_weekday(ctx) -> list[dict]:
    return [{"day": WEEKDAYS[int(wd)][:3], "shifts": int(rows["date"].nunique()),
             **{k: v for k, v in _kpis(rows).items() if k in ("oee_pct", "downtime_min")}}
            for wd, rows in ctx.hours.groupby(ctx.hours["date"].dt.day_of_week)]


def _today(ctx) -> dict:
    kpis = _kpis(ctx.hours[ctx.hours["date"] == ctx.today])
    return {"date": f"{ctx.today:%a %d %b}", "shift_hour": ctx.cur_hour, **kpis,
            "vs_target_pp": round(kpis["oee_pct"] - 85.0, 1)}


def _what(rows) -> str:
    station = rows["Zariadenie"].iloc[0]
    return f"{STATIONS.get(station, station)}: {rows['Popis_EN'].iloc[0]}"


def _top_losses(ctx, n: int = 5) -> list[dict]:
    out = []
    if not ctx.downtime.empty:
        for code, rows in ctx.downtime.groupby("Kod_chyby"):
            out.append({"code": code, "type": "stop", "what": _what(rows), "count": len(rows),
                        "loss_pcs": round(float(rows["Trvanie_min"].sum()), 1)})
    for key, column in SPEED_COLUMNS.items():
        out.append({"code": key, "type": "speed", "loss_pcs": round(float(ctx.hours[column].sum()) / 60, 1)})
    if not ctx.nok.empty:
        for code, rows in ctx.nok.groupby("Kod_chyby"):
            out.append({"code": code, "type": "defect", "what": rows["Popis_EN"].iloc[0],
                        "loss_pcs": round(float(rows["NOK_ks"].sum()), 1)})
    return sorted(out, key=lambda item: item["loss_pcs"], reverse=True)[:n]


def _when(expected_at: str, today) -> str:
    """"today 09:08", "tomorrow 08:08", "Mon 30 Nov 11:08" — so "tomorrow" is never guessed."""
    at = pd.Timestamp(expected_at)
    days = (at.normalize() - today).days
    day = "today" if days == 0 else "tomorrow" if days == 1 else f"{at:%a %d %b}"
    return f"{day} {at:%H:%M}"


def _gain(data, remove: list[str]) -> dict:
    r = what_if(data, remove)
    return {"remove": remove, "gain_pp": r["gain_pp"], "gain_pcs": r["gain_pcs"],
            "oee_after_pct": round(100 * r["oee_after"], 1)}


def _fix(fixes: dict, code: str) -> dict | None:
    f = fixes.get(code)
    return f and {"action": f.get("action"), "owner_role": f.get("owner_role")}


def _patterns(insights: list[dict], ctx) -> dict:
    """Recurring stops and slow hours, as short facts."""
    stops = []
    for i in insights:
        if i["kind"] != "recurring_stop":
            continue
        rows = ctx.downtime[ctx.downtime["Kod_chyby"] == i["code"]]
        _, day, hour = i["id"].rsplit(":", 2)
        start = rows.loc[rows["hour"] == int(hour), "Cas_od"]
        m = re.match(r"(\d+) of (\d+)", i["evidence"])
        stops.append({"code": i["code"], "what": _what(rows), "every": f"{day.title()} {start.dt.strftime('%H:%M').mode().iloc[0]}",
                      "seen": f"{m.group(1)} of {m.group(2)} weeks" if m else None,
                      "loss_pcs": i["loss_pcs"]})
    slow = [{"shift_hour": int(i["code"].rsplit("_", 1)[1]), "loss_pcs": i["loss_pcs"],
             "title": i["title"]} for i in insights if i["kind"] == "slow_hour"]
    return {"recurring_stops": stops, "slow_hours": slow}


def _focus_code(ctx, data, code: str, fixes: dict) -> dict:
    """Facts about one error code, as on the Error detail screen."""
    stops = ctx.downtime[ctx.downtime["Kod_chyby"] == code] if not ctx.downtime.empty else ctx.downtime
    defects = ctx.nok[ctx.nok["Kod_chyby"] == code] if not ctx.nok.empty else ctx.nok
    if len(stops):
        when = stops.groupby([stops["date"].dt.day_of_week, stops["Cas_od"].dt.strftime("%H:%M")]).size()
        facts = {"type": "stop", "what": _what(stops), "count": len(stops),
                 "minutes": round(float(stops["Trvanie_min"].sum()), 1),
                 "loss_pcs": round(float(stops["Trvanie_min"].sum()), 1),
                 "when": [f"{WEEKDAYS[int(wd)][:3]} {t} ×{n}" for (wd, t), n in when.items()]}
    elif len(defects):
        facts = {"type": "defect", "what": defects["Popis_EN"].iloc[0], "count": int(len(defects)),
                 "loss_pcs": round(float(defects["NOK_ks"].sum()), 1)}
    elif code in SPEED_COLUMNS:
        facts = {"type": "speed", "loss_pcs": round(float(ctx.hours[SPEED_COLUMNS[code]].sum()) / 60, 1)}
    else:
        return {"code": code, "note": "no occurrences"}
    nxt = next((u for u in upcoming(data) if u["code"] == code), None)
    return {"code": code, **facts,
            "loss_pp": round(facts["loss_pcs"] / ctx.plan_period * 100, 2) if ctx.plan_period else 0.0,
            "why": explain(data, code),
            "next": nxt and {"when": _when(nxt["expected_at"], ctx.today), "confidence": nxt["confidence"]},
            "fix": _fix(fixes, code),
            "gain_if_fixed": _gain(data, [code])}


def _asked_weekday(question: str) -> int | None:
    """A weekday named in the question, English ("Wednesdays") or Slovak ("v stredu")."""
    words = re.findall(r"[a-z]+", _lang.fold(question))
    for w in words:
        for name, n in WEEKDAY_WORDS.items():
            if w in (name, name + "s", name[:3]):
                return n
        for n, stem in enumerate(_lang.SK_DAY_STEMS):
            if w.startswith(stem):
                return n
    return None


def _focus_weekday(ctx, data, weekday: int, patterns: dict, fixes: dict) -> dict:
    """A weekday in the question: its OEE against the other days and the stops that recur on it."""
    days = _by_weekday(ctx)
    this = next((d for d in days if d["day"] == WEEKDAYS[weekday][:3]), None)
    others = ctx.hours[ctx.hours["date"].dt.day_of_week != weekday]
    recurring = [s for s in patterns["recurring_stops"] if s["every"].startswith(WEEKDAYS[weekday][:3])]
    return {"weekday": WEEKDAYS[weekday], "oee_pct": this and this["oee_pct"],
            "downtime_min": this and this["downtime_min"],
            "other_days_oee_pct": _kpis(others)["oee_pct"] if len(others) else None,
            "recurring_stops": [s | {"fix": _fix(fixes, s["code"]), "gain_if_fixed": _gain(data, [s["code"]])}
                                for s in recurring]}


BASE_TTL_S = 120
_base_cache: dict[tuple, tuple[float, tuple]] = {}
_base_lock = threading.Lock()


def _base_key(data) -> tuple:
    """The same simulated day, stops so far and 5-minute slot share the costly part of the snapshot."""
    sim_time = data["hours"].attrs.get("sim_time")
    slot = pd.Timestamp(sim_time).floor("5min").isoformat() if sim_time is not None else "all"
    return (slot, len(data["hours"]), len(data["downtime"]), len(data["nok"]), str(_engine.COUNTERMEASURES_PATH))


def _base(data) -> tuple:
    """(ctx, fixes, patterns, snapshot part without role, actions and focus). Insights, upcoming
    stops and the what-if gains are the costly part (a second or more on a small cloud CPU), so
    they are computed once per key and shared by every question and the warm-up."""
    key = _base_key(data)
    with _base_lock:
        hit = _base_cache.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
    ctx = normalize(data)
    fixes = _load_countermeasures()
    insights = get_insights(data)
    patterns = _patterns(insights, ctx)
    recurring = [s["code"] for s in patterns["recurring_stops"]]
    slow = [f"slow_hour_{s['shift_hour']}" for s in patterns["slow_hours"]]
    gains = [_gain(data, [c]) for c in recurring]
    if len(recurring) > 1:
        gains.append(_gain(data, recurring))
    if slow:
        gains.append(_gain(data, slow))
    part = {
        "now": f"{ctx.sim_time:%Y-%m-%d %a %H:%M}" if ctx.sim_time is not None else None,
        "target_pct": 85.0,
        "month": {"from": f"{ctx.hours['date'].min():%d %b}", "to": f"{ctx.hours['date'].max():%d %b}",
                  "shifts": int(ctx.hours["date"].nunique()), **_kpis(ctx.hours)},
        "today": _today(ctx),
        "oee_by_weekday": _by_weekday(ctx),
        "top_losses": _top_losses(ctx),
        "patterns": patterns,
        "upcoming": [{"when": _when(u["expected_at"], ctx.today), "code": u["code"], "what": u["title"],
                      "confidence": u["confidence"], "risk_pcs": u["risk_pcs"], "fix": _fix(fixes, u["code"])}
                     for u in upcoming(data)[:4]],
        "gains": gains,
    }
    value = (ctx, fixes, patterns, part)
    with _base_lock:
        if len(_base_cache) >= 16:
            _base_cache.clear()
        _base_cache[key] = (time.monotonic() + BASE_TTL_S, value)
    return value


def build_snapshot(data, code: str | None = None, role: str | None = None,
                   actions: list[dict] | None = None, question: str = "") -> dict:
    """What the LLM sees, kept small: KPIs, OEE by weekday, top 5 losses, patterns, upcoming stops,
    what-if gains, open actions, and the focus of the question (the error on screen or a weekday)."""
    if data["hours"].empty:
        return {"now": str(data["hours"].attrs.get("sim_time")), "note": "no production data yet"}
    ctx, fixes, patterns, part = _base(data)
    snapshot = {"now": part["now"], "role": role, **{k: v for k, v in part.items() if k != "now"},
                "open_actions": [{k: a.get(k) for k in ("title", "owner", "status")}
                                 for a in (actions or []) if a.get("status") != "done"]}
    if code:
        snapshot["focus"] = _focus_code(ctx, data, code, fixes)
    elif (weekday := _asked_weekday(question)) is not None:
        snapshot["focus"] = _focus_weekday(ctx, data, weekday, patterns, fixes)
    return snapshot


# ---------- LLM call ----------

def _parse(text: str) -> dict:
    """The model's JSON; a cut-off JSON keeps its answer; plain text becomes the answer."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        raw = json.loads(cleaned)
    except ValueError:
        m = re.search(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)', cleaned)
        if m:
            return {"answer": json.loads(f'"{m.group(1)}"').strip(), "sources": [], "followups": []}
        return {"answer": text.strip(), "sources": [], "followups": []}
    if not isinstance(raw, dict):
        return {"answer": text.strip(), "sources": [], "followups": []}

    def strings(value, limit):
        items = value if isinstance(value, list) else []
        return [s.strip() for s in items if isinstance(s, str) and s.strip()][:limit]

    answer = raw.get("answer")
    return {"answer": answer.strip() if isinstance(answer, str) else "",
            "sources": strings(raw.get("sources"), MAX_SOURCES),
            "followups": strings(raw.get("followups"), MAX_FOLLOWUPS)}


def _models() -> list[str]:
    """Primary model, then the fallback one (GEMINI_FALLBACK_MODEL="" turns it off)."""
    primary = os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL
    fallback = os.environ.get("GEMINI_FALLBACK_MODEL", FALLBACK_MODEL).strip()
    return [primary] + ([fallback] if fallback and fallback != primary else [])


_client: httpx.Client | None = None
_client_lock = threading.Lock()


def _http() -> httpx.Client:
    """One client for the whole process: TLS connections to the LLM are kept alive and reused."""
    global _client
    with _client_lock:
        if _client is None:
            _client = httpx.Client(http2=False, limits=httpx.Limits(max_keepalive_connections=4))
        return _client


def _quota_error(response) -> QuotaExceeded:
    """The 429 body names the limit that was hit and when it resets."""
    quota = limit = ""
    retry_s = 0.0
    try:
        for detail in response.json().get("error", {}).get("details", []):
            kind = detail.get("@type", "")
            if kind.endswith("QuotaFailure"):
                violation = (detail.get("violations") or [{}])[0]
                quota, limit = violation.get("quotaId", ""), str(violation.get("quotaValue", ""))
            elif kind.endswith("RetryInfo"):
                retry_s = float(str(detail.get("retryDelay", "0")).rstrip("s") or 0)
    except (ValueError, AttributeError, TypeError):
        pass
    text = f"LLM service returned HTTP 429 (quota {quota or 'unknown'}, limit {limit or '?'}"
    return QuotaExceeded(text + (f", resets in {retry_s / 60:.0f} min)" if retry_s else ")"), quota, limit, retry_s)


def _post(url: str, headers: dict, payload: bytes, timeout: float) -> dict:
    """POST and return the JSON reply; QuotaExceeded on 429, ChatUnavailable on any other failure."""
    try:
        response = _http().post(url, headers=headers, content=payload, timeout=timeout)
    except httpx.HTTPError as error:
        raise ChatUnavailable(f"LLM service did not answer ({type(error).__name__})") from error
    if response.status_code == 429:
        raise _quota_error(response)
    if response.status_code >= 400:
        raise ChatUnavailable(f"LLM service returned HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise ChatUnavailable("LLM service sent no JSON") from error


# (model, key number) -> monotonic time until which its quota is known to be used up
_exhausted: dict[tuple[str, int], float] = {}
_exhausted_lock = threading.Lock()
EXHAUSTED_MIN_S = 60  # a per-minute limit: try again soon; a daily one: skip until it resets

# After the LLM has failed (quota, timeout, outage), questions the engine can answer get that answer
# at once for LLM_DOWN_S instead of waiting up to TIMEOUT_S for another failure; the warm-up pauses.
LLM_DOWN_S = 60.0
_llm_down_until = 0.0


def _llm_down() -> bool:
    return time.monotonic() < _llm_down_until


def _mark_llm(ok: bool) -> None:
    global _llm_down_until
    with _exhausted_lock:
        _llm_down_until = 0.0 if ok else time.monotonic() + LLM_DOWN_S


def _request(model: str, keys: list[str], body: bytes, timeout: float) -> tuple[str, str]:
    """One model, each key in turn: a 429 on the first key is retried once with the second.
    A key whose daily quota for this model is used up is skipped until it resets."""
    deadline = time.monotonic() + timeout
    last: ChatUnavailable | None = None
    for number, key in enumerate(keys, start=1):
        with _exhausted_lock:
            until = _exhausted.get((model, number), 0)
        if until > time.monotonic():
            last = QuotaExceeded(f"{model}: key #{number} quota used up, skipped")
            continue
        left = deadline - time.monotonic()
        if left <= 0.05:
            break
        try:
            reply = _post(API_URL.format(model=model), {"Content-Type": "application/json", "x-goog-api-key": key},
                          body, left)
            parts = reply["candidates"][0]["content"]["parts"]
            return "".join(part.get("text", "") for part in parts if not part.get("thought")), model
        except QuotaExceeded as error:
            log.warning("Gemini 429 QUOTA model=%s key=#%d quota=%s limit=%s resets_in=%.0f s%s", model, number,
                        error.quota or "?", error.limit or "?", error.retry_s,
                        " -> trying key #2" if number < len(keys) else "")
            if error.retry_s >= EXHAUSTED_MIN_S:
                with _exhausted_lock:
                    _exhausted[(model, number)] = time.monotonic() + error.retry_s
            last = QuotaExceeded(f"{model}: {error}", error.quota, error.limit, error.retry_s)
        except ChatUnavailable as error:
            raise ChatUnavailable(f"{model}: {error}") from error
        except (KeyError, IndexError, TypeError) as error:
            raise ChatUnavailable(f"{model}: unexpected LLM reply") from error
    raise last or ChatUnavailable(f"{model}: no time left")


def _call(keys: list[str], body: bytes) -> tuple[str, str]:
    """(text, model) of the first answer within TIMEOUT_S. The fallback model starts as soon as the
    primary fails, or runs alongside it once the primary has taken HEDGE_S without answering."""
    models = _models()
    deadline = time.monotonic() + TIMEOUT_S
    pool = ThreadPoolExecutor(max_workers=len(models))
    errors: list[ChatUnavailable] = []
    try:
        pending = {pool.submit(_request, models[0], keys, body, TIMEOUT_S)}
        waiting = models[1:]
        while pending:
            left = deadline - time.monotonic()
            if left <= 0:
                break
            done, pending = wait(pending, timeout=min(left, HEDGE_S) if waiting else left,
                                 return_when=FIRST_COMPLETED)
            for future in done:
                try:
                    return future.result()
                except ChatUnavailable as error:
                    errors.append(error)
            if waiting and (not pending or not done):  # primary failed, or is slow
                pending.add(pool.submit(_request, waiting.pop(0), keys, body,
                                        max(1.0, deadline - time.monotonic())))
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise errors[-1] if errors else ChatUnavailable(f"LLM did not answer within {TIMEOUT_S:g} s")


# ---------- number check ----------

_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?")
_CODE = re.compile(r"\b[A-Za-z]+[-_]\d+\b")  # ST-038, Q-031, slow_hour_1: names, not numbers


def _numbers(text: str) -> set[str]:
    """Numbers in a text, normalised: "87.0" and "87" are the same, "1,04" is "1.04", "09" is "9"."""
    out = set()
    for raw in _NUMBER.findall(_CODE.sub(" ", text)):
        value = raw.replace(",", ".")
        if "." in value:
            value = value.rstrip("0").rstrip(".")
        out.add(value.lstrip("0") or "0")
    return out


def unverified_numbers(answer: str, source: str) -> list[str]:
    """Numbers in the answer that do not appear in the snapshot (or the question). Small counts
    (0-10) are allowed, they also come from words such as "two" or "4 of 4"."""
    allowed = _numbers(source)
    return sorted(n for n in _numbers(answer) - allowed if not (n.isdigit() and int(n) <= 10))


# ---------- cache ----------

_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def _cache_key(question: str, code, role, history: list[dict], data, lang: str = _lang.EN) -> str:
    """Same question, error, role, history and simulated day → same answer. A stop that starts
    today changes the key too, so an answer never misses a stop that has happened since."""
    ctx_time = data["hours"].attrs.get("sim_time")
    if ctx_time is None:
        moment = "all"
    else:
        day = pd.Timestamp(ctx_time).strftime("%Y%m%d")
        ids = data["downtime"]["Hodina_ID"].astype(str) if len(data["downtime"]) else pd.Series(dtype=str)
        moment = f"{day} stops={int(ids.str.contains(f'-{day}-').sum())}"
    text = " ".join(re.findall(r"\w+", question.lower()))
    turns = json.dumps(history, sort_keys=True, ensure_ascii=False)
    raw = json.dumps([lang, text, code or "", role or "", moment, turns], ensure_ascii=False)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> dict | None:
    with _cache_lock:
        hit = _cache.get(key)
        if hit and hit[0] > time.monotonic():
            return dict(hit[1])
        _cache.pop(key, None)
        return None


def _cache_put(key: str, value: dict) -> None:
    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            now = time.monotonic()
            for k in [k for k, (expires, _) in _cache.items() if expires <= now] or list(_cache)[:CACHE_MAX // 4]:
                _cache.pop(k, None)
        _cache[key] = (time.monotonic() + CACHE_TTL_S, dict(value))


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()
    global _llm_down_until
    with _exhausted_lock:
        _exhausted.clear()
        _llm_down_until = 0.0
    with _base_lock:
        _base_cache.clear()


# ---------- chat ----------

def _history(history: list[dict] | None) -> list[dict]:
    turns = []
    for turn in (history or [])[-HISTORY_TURNS:]:
        text = str(turn.get("text", "")).strip()[:MAX_TEXT]
        if text:
            turns.append({"role": "assistant" if turn.get("role") == "assistant" else "user", "text": text})
    return turns


def chat(question: str, data, history: list[dict] | None = None, code: str | None = None,
         role: str | None = None, actions: list[dict] | None = None, _warming_up: bool = False) -> dict:
    """{answer, sources, followups}. history: earlier turns [{role: user|assistant, text}]."""
    key = _key()
    question = (question or "").strip()
    if not question:  # nothing to ask: no LLM call, just the starters
        return {"answer": "", "sources": [], "followups": suggestions(data, code, role)[:MAX_FOLLOWUPS]}

    lang = _lang.detect(question)
    turns = _history(history)
    cache_key = _cache_key(question, code, role, turns, data, lang)
    cached = _cache_get(cache_key)
    if cached is None and not _warming_up:
        if _llm_down() and (backup := _engine_answer(question, data, code, role, actions, lang)):
            return backup
        cached = _wait_for_warm_up(cache_key)
        if cached is None and _llm_down() and (backup := _engine_answer(question, data, code, role, actions, lang)):
            return backup  # the warm-up of this question has just failed
    if cached is not None:
        log.info("chat cache hit q=%r code=%s", question[:60], code)
        return cached

    started = time.perf_counter()
    snap = build_snapshot(data, code, role, actions, question)
    snapshot = json.dumps(snap, ensure_ascii=False, separators=(",", ":"), default=str)
    built = time.perf_counter()
    contents = [{"role": "model" if t["role"] == "assistant" else "user", "parts": [{"text": t["text"]}]}
                for t in turns]
    contents.append({"role": "user", "parts": [
        {"text": f"{_lang.INSTRUCTION[lang]}\n\nSnapshot:\n{snapshot}\n\nQuestion: {question}"}]})
    body = json.dumps({
        "system_instruction": {"parts": [{"text": SYSTEM}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": MAX_OUTPUT_TOKENS,
                             "thinkingConfig": {"thinkingLevel": "minimal"},
                             "responseMimeType": "application/json", "responseSchema": RESPONSE_SCHEMA},
    }).encode("utf-8")
    try:
        text, model = _call(_keys(), body)
        result = _parse(text)
        if not result["answer"]:
            raise ChatUnavailable(f"{model}: empty answer")
        _mark_llm(True)
    except ChatUnavailable as error:
        _mark_llm(False)
        # The LLM failed or took too long: answer from our own data when the question allows it.
        backup = fallback.answer(question, snap, code, role, suggestions(data, code, role, lang), lang)
        log.warning("chat llm failed after %d ms (%s); %s", (time.perf_counter() - built) * 1000, error,
                    "answered from engine data" if backup else "no engine answer, 503")
        if backup is None:
            raise
        return backup  # not cached: the next tap tries the LLM again
    finally:
        answered = time.perf_counter()
        log.info("chat snapshot=%d ms (%d chars) llm=%d ms q=%r code=%s", (built - started) * 1000,
                 len(snapshot), (answered - built) * 1000, question[:60], code)
    log.info("chat answered by %s in %s", model, lang)
    unknown = unverified_numbers(result["answer"], snapshot + " " + question)
    if unknown:
        log.warning("chat numbers not in the snapshot %s q=%r answer=%r", unknown, question[:60],
                    result["answer"][:200])
    if not result["followups"]:
        result["followups"] = [q for q in suggestions(data, code, role, lang) if q != question][:MAX_FOLLOWUPS]
    _cache_put(cache_key, result)
    return result


# ---------- starter questions and warm-up ----------

def _engine_answer(question: str, data, code, role, actions, lang: str) -> dict | None:
    """The engine-data answer, used at once while the LLM is known to be down."""
    snap = build_snapshot(data, code, role, actions, question)
    backup = fallback.answer(question, snap, code, role, suggestions(data, code, role, lang), lang)
    if backup:
        log.info("chat llm down (for %.0f s more): engine answer q=%r", _llm_down_until - time.monotonic(),
                 question[:60])
    return backup


def suggestions(data, code: str | None = None, role: str | None = None, lang: str = _lang.EN) -> list[str]:
    """3-4 starter questions for the screen (code = Error detail), the user's role and the language."""
    _key()
    if lang == _lang.SK:
        return _suggestions_sk(data, code, role)
    who = role or "we"
    if code:
        out = [f"Why does {code} happen?", f"How much do we gain if we fix {code}?"]
        if any(u["code"] == code for u in upcoming(data)):
            out.append(f"When is {code} expected next?")
        out.append(f"What should {who} do about {code}?")
        return out[:4]

    ctx = normalize(data)
    out = []
    if not ctx.hours.empty and ctx.hours["date"].nunique() >= 5:
        days = _by_weekday(ctx)
        worst = min(days, key=lambda d: d["oee_pct"])
        out.append(f"Why is OEE low on {WEEKDAYS[[w[:3] for w in WEEKDAYS].index(worst['day'])]}s?")
    out.append(f"What should {who} prepare for tomorrow?")
    out.append("Which error costs us the most?")
    out.append("How is today's shift going?")
    return out[:4]


def _suggestions_sk(data, code: str | None, role: str | None) -> list[str]:
    """The same starters in Slovak, with diacritics."""
    who = _lang.SK_ROLES.get(role or "")
    if code:
        out = [f"Prečo vzniká {code}?", f"Koľko získame, ak opravíme {code}?"]
        if any(u["code"] == code for u in upcoming(data)):
            out.append(f"Kedy sa {code} očakáva najbližšie?")
        out.append(f"Ako má {who} riešiť {code}?" if who else f"Ako máme riešiť {code}?")
        return out[:4]
    ctx = normalize(data)
    out = []
    if not ctx.hours.empty and ctx.hours["date"].nunique() >= 5:
        worst = min(_by_weekday(ctx), key=lambda d: d["oee_pct"])
        n = [w[:3] for w in WEEKDAYS].index(worst["day"])
        out.append(f"Prečo je OEE {_lang.SK_DAY_ON[n]} nízke?")
    out.append(f"Čo má {who} pripraviť na zajtra?" if who else "Čo máme pripraviť na zajtra?")
    out.append("Ktorá chyba nás stojí najviac?")
    out.append("Ako ide dnešná zmena?")
    return out[:4]


_warm_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chat-warm")
# key -> [done event, running?]: a tap on a question that is being warmed up right now waits for
# that answer instead of asking the LLM a second time; a question still queued is asked live.
_warming: dict[str, list] = {}
_warm_lock = threading.Lock()


def _wait_for_warm_up(key: str) -> dict | None:
    with _warm_lock:
        entry = _warming.get(key)
        if not entry or not entry[1]:
            return None
        done = entry[0]
    started = time.perf_counter()
    done.wait(TIMEOUT_S + 1)
    log.info("chat waited %d ms for the warm-up of the same question", (time.perf_counter() - started) * 1000)
    return _cache_get(key)


WARM_CODE_QUESTIONS = 2  # on Error detail: "Why does X happen?" and "How much do we gain if we fix X?"


def warm_up(data, role: str | None = None, actions: list[dict] | None = None, code: str | None = None,
            lang: str = _lang.EN) -> int:
    """Answer the starter questions of a screen in the background, one at a time, so tapping one is
    instant: the Now screen's four, or the first two of Error detail for `code`. Returns how many
    were queued. Does nothing without a key."""
    try:
        questions = suggestions(data, code, role, lang)
    except ChatUnavailable:
        return 0
    if code:
        questions = questions[:WARM_CODE_QUESTIONS]
    if data["hours"].empty:  # start of the first shift: nothing to answer from yet
        return 0
    queued = 0
    for question in questions:
        key = _cache_key(question, code, role, [], data, _lang.detect(question))
        with _warm_lock:
            if key in _warming or _cache_get(key) is not None:
                continue
            _warming[key] = [threading.Event(), False]

        def run(q=question, k=key):
            entry = _warming[k]
            try:
                if _cache_get(k) is not None:  # a tap asked it live while it was queued
                    return
                if _llm_down():  # no point asking now; a tap gets the engine answer
                    log.info("chat warm-up paused, llm down: %r", q[:60])
                    return
                with _warm_lock:
                    entry[1] = True
                chat(q, data, code=code, role=role, actions=actions, _warming_up=True)
            except Exception as error:  # a warm-up failure only means the tap asks live
                log.info("chat warm-up skipped %r: %s", q[:60], error)
            finally:
                with _warm_lock:
                    _warming.pop(k, None)
                entry[0].set()

        _warm_pool.submit(run)
        queued += 1
    return queued
