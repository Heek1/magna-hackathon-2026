"""get_insights: run the detectors, attach countermeasures, sort by loss."""
from __future__ import annotations

import json
from pathlib import Path

from .common import normalize
from .detectors import DETECTORS

# Prepared by another team member: {key: {action, method, owner_role}}; may be absent.
COUNTERMEASURES_PATH = Path(__file__).with_name("countermeasures.json")


def _load_countermeasures() -> dict:
    try:
        return json.loads(COUNTERMEASURES_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def get_insights(data) -> list[dict]:
    """Insights in the /api/insights format.

    data: {"hours", "downtime", "nok"} — DataFrames trimmed to sim_time, as passed by
    app/insights_bridge.py (sim_time is in df.attrs).
    """
    ctx = normalize(data)
    if ctx.hours.empty:
        return []
    countermeasures = _load_countermeasures()

    insights = []
    for detector in DETECTORS:
        insights.extend(detector(ctx))

    for item in insights:
        entry = next((countermeasures[k] for k in item.pop("_keys") if k in countermeasures), None)
        if entry:
            item["recommendation"] = {
                "action": entry.get("action"),
                "method": entry.get("method"),
                "owner_role": entry.get("owner_role"),
                "expected_gain_pcs": item["loss_pcs"],
            }
    insights.sort(key=lambda item: item["loss_pcs"], reverse=True)
    return insights
