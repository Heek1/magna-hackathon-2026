"""chat: answers a question with an LLM, strictly from a compact snapshot of the data."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from .common import normalize
from .engine import get_insights
from .whatif import SPEED_COLUMNS

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-3.5-flash-lite"  # override with GEMINI_MODEL
TIMEOUT_S = 30

SYSTEM = (
    "You are the OEE assistant of an electric drive assembly line (10 stations, ideal cycle 60 s, "
    "shift 06:00-14:00, OEE target 85 %). Answer only from the JSON snapshot in the message: KPIs, "
    "losses and insights computed from the line data up to sim_time. Quote the concrete numbers, "
    "codes and dates from it. If the snapshot does not contain the answer, say so instead of "
    "guessing. Losses are in pieces (1 planned minute = 1 piece); pp = OEE percentage points. "
    "Be brief: a few sentences or a short list. Answer in the language of the question."
)


class ChatUnavailable(RuntimeError):
    """No LLM key configured; the API turns this into 503."""


def _kpis(hours) -> dict:
    plan, run = float(hours["Plan_min"].sum()), float(hours["Chod_min"].sum())
    produced, ok = float(hours["Vyrobene_ks"].sum()), float(hours["OK_ks"].sum())
    return {
        "plan_min": round(plan, 1),
        "downtime_min": round(float(hours["Prestoj_min"].sum()), 1),
        "produced": round(produced, 1),
        "ok": round(ok, 1),
        "nok": round(float(hours["NOK_ks"].sum()), 1),
        "availability": round(run / plan, 4) if plan else 0.0,
        "performance": round(produced / run, 4) if run else 0.0,
        "quality": round(ok / produced, 4) if produced else 0.0,
        "oee": round(ok / plan, 4) if plan else 0.0,
    }


def _losses(ctx) -> list[dict]:
    out = []
    if not ctx.downtime.empty:
        for (code, device), rows in ctx.downtime.groupby(["Kod_chyby", "Zariadenie"]):
            out.append({"type": "downtime", "code": code, "device": device,
                        "description": rows["Popis_EN"].iloc[0], "count": len(rows),
                        "loss_pcs": round(float(rows["Trvanie_min"].sum()), 1)})
    for key, column in SPEED_COLUMNS.items():
        out.append({"type": key, "code": key, "loss_pcs": round(float(ctx.hours[column].sum()) / 60, 1)})
    if not ctx.nok.empty:
        for code, rows in ctx.nok.groupby("Kod_chyby"):
            out.append({"type": "nok", "code": code, "description": rows["Popis_EN"].iloc[0],
                        "loss_pcs": round(float(rows["NOK_ks"].sum()), 1)})
    return sorted(out, key=lambda item: item["loss_pcs"], reverse=True)


def build_snapshot(data) -> dict:
    """What the LLM sees: KPIs of the period and of today, per-day OEE, losses, insights."""
    ctx = normalize(data)
    if ctx.hours.empty:
        return {"sim_time": str(ctx.sim_time), "note": "no production data yet"}
    days = [{"date": f"{date:%Y-%m-%d %a}", **{k: v for k, v in _kpis(rows).items()
                                             if k in ("oee", "downtime_min", "nok")}}
            for date, rows in ctx.hours.groupby("date")]
    insights = [{k: i[k] for k in ("kind", "severity", "title", "evidence", "code", "loss_pcs",
                                   "loss_pp", "expected_at")}
                | {"countermeasure": i["recommendation"]}
                for i in get_insights(data)]
    return {
        "sim_time": str(ctx.sim_time) if ctx.sim_time is not None else None,
        "oee_target": 0.85,
        "period": {"from": f"{ctx.hours['date'].min():%Y-%m-%d}",
                   "to": f"{ctx.hours['date'].max():%Y-%m-%d}", **_kpis(ctx.hours)},
        "today": {"date": f"{ctx.today:%Y-%m-%d %a}", "current_shift_hour": ctx.cur_hour,
                  **_kpis(ctx.hours[ctx.hours["date"] == ctx.today])},
        "days": days,
        "losses_pcs": _losses(ctx),
        "insights": insights,
    }


def chat(question: str, data) -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ChatUnavailable("GEMINI_API_KEY is not set")
    if not question.strip():
        return ""  # the frontend probes availability with an empty question: no LLM call
    snapshot = json.dumps(build_snapshot(data), ensure_ascii=False)
    body = {
        "system_instruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user",
                      "parts": [{"text": f"Snapshot:\n{snapshot}\n\nQuestion: {question}"}]}],
        "generationConfig": {"temperature": 0.2},
    }
    request = urllib.request.Request(
        API_URL.format(model=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)),
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    # The API turns any exception into 503, which hides the chat panel for good; that is meant
    # for a missing key only, so a failed LLM call is answered in words instead.
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            reply = json.load(response)
        parts = reply["candidates"][0]["content"]["parts"]
        return "".join(part.get("text", "") for part in parts).strip()
    except urllib.error.HTTPError as error:
        return f"The assistant could not answer (LLM service returned HTTP {error.code}). Please try again."
    except (OSError, KeyError, IndexError, ValueError):
        return "The assistant could not answer (LLM service did not respond). Please try again."
