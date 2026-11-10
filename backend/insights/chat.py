"""chat: answers questions with an LLM, strictly from a compact snapshot of the data.

chat(question, data, history, code, role, actions) -> {answer, sources, followups}
suggestions(data, code, role) -> 3-4 starter questions
Both raise ChatUnavailable without GEMINI_API_KEY; chat also when the LLM fails or times out.
The API turns ChatUnavailable into 503.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request

from .common import WEEKDAYS, normalize
from .engine import _load_countermeasures, get_insights
from .explain import explain
from .upcoming import upcoming
from .whatif import SPEED_COLUMNS, what_if

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-3.5-flash-lite"  # override with GEMINI_MODEL
TIMEOUT_S = 10
RETRY_PAUSE_S = 0.5
RETRY_MIN_S = 4    # retry only if at least this much of the budget is left
HISTORY_TURNS = 6
MAX_TEXT = 600          # characters kept per history turn
MAX_SOURCES = 4
MAX_FOLLOWUPS = 3

SYSTEM = (
    "You are the AI assistant of the OEE Improvement Engine for an electric drive assembly line "
    "(10 stations, ideal cycle 60 s, shift 06:00-14:00, OEE target 85 %). Answer only from the JSON "
    "snapshot in the last message. Quote numbers, codes and dates exactly as the snapshot gives them "
    "and do not calculate new ones: for gains use the what_if entries. If the snapshot does not "
    "contain the answer, say so. 1 lost piece = 1 planned minute; pp = OEE percentage points; "
    "*_pct values are percentages.\n"
    "If user_role is set, answer from that role's point of view and put the fixes owned by that role "
    "first. If focus_error is set, the question is about that error unless it says otherwise.\n"
    "At most 80 words, plain text without markdown. Answer in the language of the question.\n"
    "Return JSON: answer; sources: 1-4 short labels (at most 5 words) of the snapshot facts you used, "
    "e.g. \"ST-038 · 4 stops\", \"OEE by weekday\"; followups: 2-3 short next questions the user "
    "could tap, in the language of the question, answerable from the snapshot."
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


class ChatUnavailable(RuntimeError):
    """No LLM key, or the LLM failed or timed out; the API turns this into 503."""


def _key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise ChatUnavailable("GEMINI_API_KEY is not set")
    return key


# ---------- snapshot ----------

def _pct(part: float, whole: float) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def _kpis(hours) -> dict:
    plan, run = float(hours["Plan_min"].sum()), float(hours["Chod_min"].sum())
    produced, ok = float(hours["Vyrobene_ks"].sum()), float(hours["OK_ks"].sum())
    return {  # percentages ready to quote, so the model never rounds or converts
        "oee_pct": _pct(ok, plan),
        "availability_pct": _pct(run, plan),
        "performance_pct": _pct(produced, run),
        "quality_pct": _pct(ok, produced),
        "lost_pcs": round(plan - ok, 1),
        "downtime_min": round(float(hours["Prestoj_min"].sum()), 1),
        "nok": round(float(hours["NOK_ks"].sum()), 1),
    }


def _by_weekday(ctx) -> list[dict]:
    out = []
    for wd, rows in ctx.hours.groupby(ctx.hours["date"].dt.day_of_week):
        k = _kpis(rows)
        out.append({"weekday": WEEKDAYS[int(wd)], "shifts": int(rows["date"].nunique()),
                    "oee_pct": k["oee_pct"], "downtime_min": k["downtime_min"], "nok": k["nok"]})
    return out


def _losses(ctx) -> list[dict]:
    out = []
    if not ctx.downtime.empty:
        for (code, device), rows in ctx.downtime.groupby(["Kod_chyby", "Zariadenie"]):
            out.append({"code": code, "type": "stop", "station": STATIONS.get(device, device),
                        "description": rows["Popis_EN"].iloc[0], "count": len(rows),
                        "loss_pcs": round(float(rows["Trvanie_min"].sum()), 1)})
    for key, column in SPEED_COLUMNS.items():
        out.append({"code": key, "type": "speed", "loss_pcs": round(float(ctx.hours[column].sum()) / 60, 1)})
    if not ctx.nok.empty:
        for code, rows in ctx.nok.groupby("Kod_chyby"):
            out.append({"code": code, "type": "defect", "description": rows["Popis_EN"].iloc[0],
                        "loss_pcs": round(float(rows["NOK_ks"].sum()), 1)})
    return sorted(out, key=lambda item: item["loss_pcs"], reverse=True)


def _gain(data, remove: list[str]) -> dict:
    r = what_if(data, remove)
    return {"remove": remove, "gain_pp": r["gain_pp"], "gain_pcs": r["gain_pcs"],
            "oee_before_pct": round(100 * r["oee_before"], 1), "oee_after_pct": round(100 * r["oee_after"], 1)}


def _focus(ctx, data, code: str, fixes: dict) -> dict | None:
    """Facts about one error code, as on the Error detail screen."""
    stops = ctx.downtime[ctx.downtime["Kod_chyby"] == code] if not ctx.downtime.empty else ctx.downtime
    defects = ctx.nok[ctx.nok["Kod_chyby"] == code] if not ctx.nok.empty else ctx.nok
    if len(stops):
        when = stops.groupby([stops["date"].dt.day_of_week, stops["Cas_od"].dt.strftime("%H:%M")]).size()
        facts = {"type": "stop", "description": stops["Popis_EN"].iloc[0],
                 "station": STATIONS.get(stops["Zariadenie"].iloc[0], stops["Zariadenie"].iloc[0]),
                 "count": len(stops), "minutes": round(float(stops["Trvanie_min"].sum()), 1),
                 "loss_pcs": round(float(stops["Trvanie_min"].sum()), 1),
                 "dates": sorted(f"{d:%a %d %b}" for d in set(stops["date"])),
                 "when": [{"weekday": WEEKDAYS[int(wd)], "time": t, "count": int(n)}
                          for (wd, t), n in when.items()]}
    elif len(defects):
        by_hour = defects.groupby("hour")["NOK_ks"].sum()
        facts = {"type": "defect", "description": defects["Popis_EN"].iloc[0],
                 "count": int(len(defects)), "loss_pcs": round(float(defects["NOK_ks"].sum()), 1),
                 "nok_by_shift_hour": {int(h): round(float(v), 1) for h, v in by_hour.items()}}
    elif code in SPEED_COLUMNS:
        column = SPEED_COLUMNS[code]
        by_hour = ctx.hours.groupby("hour")[column].sum() / 60
        facts = {"type": "speed", "loss_pcs": round(float(by_hour.sum()), 1),
                 "loss_pcs_by_shift_hour": {int(h): round(float(v), 1) for h, v in by_hour.items()}}
    else:
        return None
    nxt = next((u for u in upcoming(data) if u["code"] == code), None)
    return {
        "code": code, **facts,
        "loss_pp": round(facts["loss_pcs"] / ctx.plan_period * 100, 2) if ctx.plan_period else 0.0,
        "why": explain(data, code),
        "next_expected": nxt and {k: nxt[k] for k in ("expected_at", "confidence", "risk_pcs")},
        "fix": fixes.get(code),
        "gain_if_fixed": _gain(data, [code]),
    }


def build_snapshot(data, code: str | None = None, role: str | None = None,
                   actions: list[dict] | None = None) -> dict:
    """What the LLM sees: KPIs, OEE by weekday, losses, insights, upcoming stops, what-if gains,
    open actions, and the error in focus."""
    ctx = normalize(data)
    if ctx.hours.empty:
        return {"sim_time": str(ctx.sim_time), "note": "no production data yet"}
    fixes = _load_countermeasures()
    insights = get_insights(data)

    def fix_of(item):
        r = item["recommendation"]
        return r and {"action": r["action"], "owner_role": r["owner_role"]}

    compact = [{"kind": i["kind"], "code": i["code"], "evidence": i["evidence"],
                "loss_pcs": i["loss_pcs"], "loss_pp": i["loss_pp"], "expected_at": i["expected_at"],
                "fix": fix_of(i)} for i in insights]
    if role:  # the role's own fixes first
        compact.sort(key=lambda i: not (i["fix"] and i["fix"]["owner_role"] == role))

    recurring = [i["code"] for i in insights if i["kind"] == "recurring_stop"]
    slow = [i["code"] for i in insights if i["kind"] == "slow_hour"]
    gains = [_gain(data, [c]) for c in recurring]
    if len(recurring) > 1:
        gains.append(_gain(data, recurring))
    if slow:
        gains.append(_gain(data, slow))

    snapshot = {
        "sim_time": f"{ctx.sim_time:%Y-%m-%d %a %H:%M}" if ctx.sim_time is not None else None,
        "user_role": role,
        "oee_target_pct": 85.0,
        "period": {"from": f"{ctx.hours['date'].min():%Y-%m-%d}",
                   "to": f"{ctx.hours['date'].max():%Y-%m-%d}", "shifts": int(ctx.hours["date"].nunique()),
                   **_kpis(ctx.hours)},
        "today": {"date": f"{ctx.today:%Y-%m-%d %a}", "current_shift_hour": ctx.cur_hour,
                  **_kpis(ctx.hours[ctx.hours["date"] == ctx.today])},
        "oee_by_weekday": _by_weekday(ctx),
        "losses": _losses(ctx)[:10],
        "insights": compact,
        "upcoming_stops": [{k: u[k] for k in ("code", "title", "expected_at", "confidence", "risk_pcs",
                                              "evidence")} | {"fix": fixes.get(u["code"])}
                           for u in upcoming(data)],
        "what_if": gains,
        "open_actions": [{k: a.get(k) for k in ("title", "owner", "status")}
                         for a in (actions or []) if a.get("status") != "done"],
    }
    if code:
        snapshot["focus_error"] = _focus(ctx, data, code, fixes) or {"code": code, "note": "no occurrences"}
    return snapshot


# ---------- LLM call ----------

def _parse(text: str) -> dict:
    """The model's JSON; plain text becomes the answer when the JSON is broken."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    try:
        raw = json.loads(cleaned)
    except ValueError:
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


def _call(key: str, body: dict) -> str:
    """The model's text. A busy service (429 / 5xx) is tried once more while the 10 s budget lasts."""
    request = urllib.request.Request(
        API_URL.format(model=os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL),
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    deadline = time.monotonic() + TIMEOUT_S
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=max(1.0, deadline - time.monotonic())) as response:
                reply = json.load(response)
            parts = reply["candidates"][0]["content"]["parts"]
            return "".join(part.get("text", "") for part in parts if not part.get("thought"))
        except urllib.error.HTTPError as error:
            busy = error.code == 429 or error.code >= 500
            if attempt == 0 and busy and deadline - time.monotonic() > RETRY_MIN_S:
                time.sleep(RETRY_PAUSE_S)
                continue
            raise ChatUnavailable(f"LLM service returned HTTP {error.code}") from error
        except (OSError, KeyError, IndexError, TypeError, ValueError) as error:
            raise ChatUnavailable(f"LLM service did not answer ({type(error).__name__})") from error
    raise ChatUnavailable("LLM service did not answer")


def chat(question: str, data, history: list[dict] | None = None, code: str | None = None,
         role: str | None = None, actions: list[dict] | None = None) -> dict:
    """{answer, sources, followups}. history: earlier turns [{role: user|assistant, text}]."""
    key = _key()
    question = (question or "").strip()
    if not question:  # nothing to ask: no LLM call, just the starters
        return {"answer": "", "sources": [], "followups": suggestions(data, code, role)[:MAX_FOLLOWUPS]}

    contents = []
    for turn in (history or [])[-HISTORY_TURNS:]:
        text = str(turn.get("text", "")).strip()[:MAX_TEXT]
        if text:
            contents.append({"role": "model" if turn.get("role") == "assistant" else "user",
                             "parts": [{"text": text}]})
    snapshot = json.dumps(build_snapshot(data, code, role, actions), ensure_ascii=False,
                          separators=(",", ":"), default=str)
    contents.append({"role": "user", "parts": [{"text": f"Snapshot:\n{snapshot}\n\nQuestion: {question}"}]})
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600,
                             "responseMimeType": "application/json", "responseSchema": RESPONSE_SCHEMA},
    }
    result = _parse(_call(key, body))
    if not result["answer"]:
        raise ChatUnavailable("LLM returned an empty answer")
    if not result["followups"]:
        result["followups"] = [q for q in suggestions(data, code, role) if q != question][:MAX_FOLLOWUPS]
    return result


# ---------- starter questions ----------

def suggestions(data, code: str | None = None, role: str | None = None) -> list[str]:
    """3-4 starter questions for the screen (code = Error detail) and the user's role."""
    _key()
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
        out.append(f"Why is OEE low on {worst['weekday']}s?")
    out.append(f"What should {who} prepare for tomorrow?")
    out.append("Which error costs us the most?")
    out.append("How is today's shift going?")
    return out[:4]
