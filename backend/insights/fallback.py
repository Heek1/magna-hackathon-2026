"""Answers from our own data when the LLM is down or slow, so "Ask AI" never goes blank in a demo.

answer(question, snapshot, code) -> {answer, sources: ["Engine data"], followups} or None.
Built only from the snapshot the LLM would have seen (chat.build_snapshot), so every number is the
same one the screens show. Covers the starter questions and the Error detail questions; anything
else returns None and the API answers 503 as before.
"""
from __future__ import annotations

import re

SOURCE = "Engine data"
SPEED_NAMES = {"slowdown": "Slowdown", "microstop": "Microstops", "retest": "Retests"}


def _has(question: str, *words: str) -> bool:
    q = question.lower()
    return any(re.search(rf"\b{w}", q) for w in words)


def _pcs(value) -> str:
    return f"{value:g} pcs"


def _pp(value) -> str:
    return f"+{value:.2f} pp"


def _pct(value) -> str:
    return f"{value:.1f} %"


def _name(loss: dict) -> str:
    if loss["code"] in SPEED_NAMES:
        return SPEED_NAMES[loss["code"]]
    return loss["code"] + (f" ({loss['what']})" if loss.get("what") else "")


def _fix_text(fix: dict | None) -> str:
    if not fix or not fix.get("action"):
        return ""
    owner = f" ({fix['owner_role']})" if fix.get("owner_role") else ""
    return f" Fix{owner}: {fix['action'].rstrip('.')}."


def _weekday(snapshot: dict) -> str | None:
    focus = snapshot.get("focus") or {}
    if "weekday" not in focus or focus.get("oee_pct") is None:
        return None
    day = focus["weekday"]
    text = (f"OEE on {day}s is {_pct(focus['oee_pct'])} against {_pct(focus['other_days_oee_pct'])} on the "
            f"other days, with {focus['downtime_min']:g} min of downtime.")
    for stop in focus.get("recurring_stops", [])[:1]:
        gain = stop["gain_if_fixed"]
        text += (f" {stop['code']} ({stop['what']}) stops every {stop['every']} ({stop['seen']}), "
                 f"{_pcs(stop['loss_pcs'])} so far; fixing it gives {_pp(gain['gain_pp'])}.")
    return text


def _prepare(snapshot: dict, role: str | None) -> str | None:
    upcoming = snapshot.get("upcoming") or []
    if not upcoming:
        return "No repeating stops are expected in the next shifts."
    tomorrow = [u for u in upcoming if u["when"].startswith("tomorrow")]
    items = tomorrow or upcoming[:1]
    if role:  # the role's own stops first
        items = sorted(items, key=lambda u: not (u.get("fix") and u["fix"].get("owner_role") == role))
    u = items[0]
    head = "Tomorrow" if tomorrow else "Next"
    when = u["when"].removeprefix("tomorrow ") if tomorrow else u["when"]
    return (f"{head} {when}: {u['code']} ({u['what']}), {u['confidence']} confidence, "
            f"~{_pcs(u['risk_pcs'])} at risk.{_fix_text(u.get('fix'))}")


def _most(snapshot: dict) -> str | None:
    top = snapshot.get("top_losses") or []
    if not top:
        return None
    first, rest = top[0], top[1:3]
    text = f"{_name(first)} costs the most: {_pcs(first['loss_pcs'])} this month."
    if rest:
        text += " Then " + " and ".join(f"{_name(t).split(' (')[0]} {_pcs(t['loss_pcs'])}" for t in rest) + "."
    return text


def _today(snapshot: dict) -> str | None:
    today = snapshot.get("today")
    if not today:
        return None
    gap = today.get("vs_target_pp", round(today["oee_pct"] - snapshot.get("target_pct", 85.0), 1))
    side = "above" if gap >= 0 else "below"
    return (f"Today's OEE is {_pct(today['oee_pct'])} ({abs(gap):g} pp {side} the "
            f"{snapshot.get('target_pct', 85.0):g} % target): {_pcs(today['lost_pcs'])} lost and "
            f"{today['downtime_min']:g} min of downtime so far.")


def _code(question: str, focus: dict, snapshot: dict) -> str | None:
    """Questions on Error detail: gain, why, when next, what to do."""
    code = focus["code"]
    if "note" in focus:
        return f"{code} has not occurred in the data so far."
    gain = focus.get("gain_if_fixed") or {}
    if _has(question, "gain", "worth", "how much", "save", "recover"):
        before = (snapshot.get("month") or {}).get("oee_pct")
        change = f": OEE {_pct(before)} → {_pct(gain['oee_after_pct'])}" if before is not None else ""
        return f"Fixing {code} gives {_pp(gain['gain_pp'])} OEE ({_pcs(gain['gain_pcs'])}){change}."
    if _has(question, "when", "next", "expect"):
        nxt = focus.get("next")
        return (f"{code} is expected next {nxt['when']} ({nxt['confidence']} confidence)." if nxt
                else f"{code} has no repeating time, so no next stop is predicted.")
    if _has(question, "do about", "fix", "countermeasure", "should", "prevent"):
        return _fix_text(focus.get("fix")).strip() or f"There is no countermeasure for {code} yet."
    if focus.get("why"):
        return focus["why"]
    return (f"{code} ({focus.get('what', focus.get('type'))}): {focus.get('count', 0)} times, "
            f"{_pcs(focus['loss_pcs'])} lost, {focus['loss_pp']:g} pp of OEE.")


def answer(question: str, snapshot: dict, code: str | None = None, role: str | None = None,
           followups: list[str] | None = None) -> dict | None:
    """A short deterministic answer from the snapshot, or None when the question is not covered."""
    if "note" in snapshot and "today" not in snapshot:  # no data yet
        return None
    focus = snapshot.get("focus") or {}
    text = None
    if code and focus.get("code") == code:
        text = _code(question, focus, snapshot)
    elif "weekday" in focus:
        text = _weekday(snapshot)
    elif _has(question, "tomorrow", "prepare", "coming up", "expect"):
        text = _prepare(snapshot, role)
    elif _has(question, "most", "biggest", "top", "worst", "cost"):
        text = _most(snapshot)
    elif _has(question, "today", "shift", "going", "now"):
        text = _today(snapshot)
    if not text:
        return None
    return {"answer": text, "sources": [SOURCE],
            "followups": [q for q in (followups or []) if q.strip().lower() != question.strip().lower()][:3]}
