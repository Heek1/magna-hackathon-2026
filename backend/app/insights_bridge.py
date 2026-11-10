"""Calls get_insights / what_if / chat from backend/insights/ (owned by member 2).

Expected interface in backend/insights/__init__.py:
    get_insights(data) -> list[dict]                      # /api/insights items
    what_if(data, remove, from_, to) -> dict              # {oee_before, oee_after, gain_pcs, gain_pp}
    chat(question, data) -> str                           # raises if no GEMINI_API_KEY → 503
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
    from insights import chat  # type: ignore
except ImportError:
    chat = None

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


def answer(question: str, data: dict) -> str:
    if chat is None:
        raise ChatUnavailable("chat() is not implemented yet")
    return chat(question, data)
