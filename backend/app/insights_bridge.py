"""Calls get_insights / what_if / chat from backend/insights/ (owned by member 2).

Expected interface in backend/insights/__init__.py:
    get_insights(data) -> list[dict]                      # /api/insights items
    what_if(data, remove, from_, to) -> dict              # {oee_before, oee_after, gain_pcs, gain_pp}
    chat(question, data, history, code, role, actions) -> {answer, sources, followups}
    suggestions(data, code, role) -> [str]                # both raise without GEMINI_API_KEY → 503
    warm_up(data, role)                                   # starter answers into the cache, in the background
where `data` = {"hours": df, "downtime": df, "nok": df}, trimmed to sim_time
(original xlsx column names; df.attrs["sim_time"] holds the current simulation time).

Until those functions exist, the stubs below return responses with the contract shape.
"""
from __future__ import annotations

try:
    from insights import get_insights  # type: ignore
except ImportError:
    get_insights = None
try:
    from insights import what_if  # type: ignore
except ImportError:
    what_if = None
try:
    from insights import chat, suggestions as _suggestions, warm_up as _warm_up  # type: ignore
except ImportError:
    chat = _suggestions = _warm_up = None
try:
    from insights import upcoming as _upcoming  # type: ignore
except ImportError:
    _upcoming = None
try:
    from insights import explain as _explain  # type: ignore
except ImportError:
    _explain = None

from . import oee


class ChatUnavailable(RuntimeError):
    pass


def insights(data: dict) -> list[dict]:
    if get_insights:
        return get_insights(data)
    return [{
        "id": "stub-1",
        "kind": "recurring_stop",
        "severity": "high",
        "title": "Stub insight (backend/insights not implemented yet)",
        "evidence": "Placeholder until get_insights() exists.",
        "code": None,
        "loss_pcs": 0,
        "loss_pp": 0,
        "expected_at": None,
        "recommendation": None,
    }]


def whatif(data: dict, remove: list[str], from_, to) -> dict:
    if what_if:
        return what_if(data, remove, from_, to)
    hours = oee._between(data["hours"], "Datum", from_, to)
    before = oee.kpis(hours)["oee"]
    return {"oee_before": before, "oee_after": before, "gain_pcs": 0, "gain_pp": 0}


def upcoming(data: dict, horizon_hours: int = 48) -> list[dict]:
    """Stops expected after sim_time (empty without backend/insights)."""
    return _upcoming(data, horizon_hours) if _upcoming else []


def why(data: dict, code: str) -> str | None:
    """Plain-English explanation of an error code, or None."""
    if not _explain:
        return None
    try:
        return _explain(data, code)
    except Exception:  # an explanation is optional; never break the detail screen
        return None


def answer(question: str, data: dict, history: list[dict] | None = None, code: str | None = None,
           role: str | None = None, actions: list[dict] | None = None) -> dict:
    """{answer, sources, followups}; raises when the LLM is not available (the API answers 503)."""
    if chat is None:
        raise ChatUnavailable("chat() is not implemented yet")
    return chat(question, data, history=history, code=code, role=role, actions=actions)


def chat_suggestions(data: dict, code: str | None = None, role: str | None = None) -> list[str]:
    """Starter questions; raises when the LLM is not available, so the app hides "Ask AI"."""
    if _suggestions is None:
        raise ChatUnavailable("suggestions() is not implemented yet")
    questions = _suggestions(data, code, role)
    warm_chat(data, role, code)  # the screen shows these now: answer them in the background
    return questions


def warm_chat(data: dict, role: str | None = None, code: str | None = None) -> None:
    """Precompute the starter answers of a screen in the background (no-op without a key)."""
    if _warm_up is not None:
        try:
            _warm_up(data, role, code=code)
        except Exception:  # warming is an optimisation only
            pass
