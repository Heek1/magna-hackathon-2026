"""upcoming: stops expected after sim_time, for the "Coming up" block of the Now screen."""
from __future__ import annotations

import pandas as pd

from .common import SHIFT_START_HOUR, WEEKDAYS, normalize
from .detectors import RECUR_MIN_RATE, _clock, _recurring_patterns

SHIFT_HOURS = 8
LOW_CONFIDENCE_RATE = 0.5  # weaker than a recurring_stop insight, still worth a "low" warning
MAX_DAYS_AHEAD = 60


def _confidence(count: int, opportunities: int) -> str:
    if count == opportunities:
        return "high"    # same weekday and time in every past week
    if count / opportunities >= RECUR_MIN_RATE:
        return "medium"  # most weeks
    return "low"


def upcoming(data, horizon_hours: int = 48) -> list[dict]:
    """Stops expected within horizon_hours of shift time (06:00-14:00 on working days) after sim_time.

    Items: {code, kind: "stop", title, expected_at, confidence, risk_pcs, evidence, insight_id},
    sorted by expected_at. Working days are the weekdays present in the data. insight_id is the
    recurring_stop insight of /api/insights, or None for a low-confidence pattern.
    """
    ctx = normalize(data)
    if ctx.hours.empty:
        return []
    patterns = _recurring_patterns(ctx, LOW_CONFIDENCE_RATE)
    if not patterns:
        return []
    now = ctx.sim_time
    if now is None:  # whole dataset: "now" is the end of the last hour present
        now = ctx.today + pd.Timedelta(hours=SHIFT_START_HOUR + ctx.cur_hour)
    working_days = set(ctx.hours["date"].dt.day_of_week)

    out = []
    used = 0.0  # shift hours between now and the start of the day being looked at
    day = now.normalize()
    for _ in range(MAX_DAYS_AHEAD):
        if used >= horizon_hours:
            break
        if day.day_of_week in working_days:
            shift_start = day + pd.Timedelta(hours=SHIFT_START_HOUR)
            shift_end = shift_start + pd.Timedelta(hours=SHIFT_HOURS)
            start = max(now, shift_start)  # the part of this shift that is still ahead
            for p in patterns:
                expected_at = day + pd.Timedelta(minutes=p["start_min"])
                if p["weekday"] != day.day_of_week or expected_at <= now or day in p["dates"]:
                    continue
                if used + (expected_at - start) / pd.Timedelta(hours=1) > horizon_hours:
                    continue
                durations = p["finished_durations"] or p["durations"]
                weekday = WEEKDAYS[p["weekday"]]
                confidence = _confidence(len(p["dates"]), p["opportunities"])
                out.append({
                    "code": p["code"],
                    "kind": "stop",
                    "title": p["description"],
                    "expected_at": expected_at.isoformat(),
                    "confidence": confidence,
                    "risk_pcs": round(sum(durations) / len(durations), 1),
                    "evidence": (f"{len(p['dates'])} of {p['opportunities']} {weekday}s "
                                 f"at {_clock(p['start_min'])}"),
                    # a low-confidence pattern is below the recurring_stop threshold: no insight
                    "insight_id": (None if confidence == "low" else
                                   f"recurring_stop:{p['code']}:{weekday[:3].lower()}:{p['hour']}"),
                })
            used += max(0.0, (shift_end - start) / pd.Timedelta(hours=1))
        day += pd.Timedelta(days=1)
    return sorted(out, key=lambda item: item["expected_at"])
