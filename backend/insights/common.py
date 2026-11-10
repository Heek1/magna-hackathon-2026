"""Shared helpers: input normalisation, "now", loss percentages, formatting."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHIFT_START_HOUR = 6
_ID_PATTERN = r"-(\d{8})-(\d+)$"  # Hodina_ID looks like L01-20261125-04


@dataclass
class Context:
    hours: pd.DataFrame      # + date (Timestamp at midnight), hour (shift hour 1..8)
    downtime: pd.DataFrame   # + date, hour
    nok: pd.DataFrame        # + date, hour
    sim_time: pd.Timestamp | None
    today: pd.Timestamp | None
    cur_hour: int            # latest shift hour of today present in hours, 0 if none
    plan_period: float       # planned minutes of everything visible
    plan_day: float          # planned minutes of a typical full shift


def _with_date_hour(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if df.empty:
        df["date"] = pd.Series(dtype="datetime64[ns]")
        df["hour"] = pd.Series(dtype="int64")
        return df
    parts = df["Hodina_ID"].astype(str).str.extract(_ID_PATTERN)
    df["date"] = pd.to_datetime(parts[0], format="%Y%m%d")
    df["hour"] = parts[1].astype(int)
    return df


def normalize(data: dict) -> Context:
    """data = {"hours", "downtime", "nok"} as built by app.sim.Snapshot.as_frames():
    the xlsx sheets trimmed to sim_time, with sim_time in df.attrs. The running hour is
    partial and an active stop has Trvanie_min clipped to sim_time, so values may be fractional.
    Without sim_time (the whole dataset), "now" is the last hour present.
    """
    sim_time = data["hours"].attrs.get("sim_time")
    hours = _with_date_hour(data["hours"])
    downtime = _with_date_hour(data["downtime"])
    nok = _with_date_hour(data["nok"])

    sim_time = pd.Timestamp(sim_time) if sim_time is not None else None
    if sim_time is not None:
        today = sim_time.normalize()
    elif not hours.empty:
        today = hours["date"].max()
    else:
        today = None

    cur_hour, plan_period, plan_day = 0, 0.0, 0.0
    if not hours.empty:
        today_rows = hours[hours["date"] == today]
        if not today_rows.empty:
            cur_hour = int(today_rows["hour"].max())
        plan_period = float(hours["Plan_min"].sum())
        past_days = hours[hours["date"] < today].groupby("date")["Plan_min"].sum()
        plan_day = float(past_days.median()) if len(past_days) else float(today_rows["Plan_min"].sum())

    return Context(hours, downtime, nok, sim_time, today, cur_hour, plan_period, plan_day)


def pp(loss_pcs: float, plan_min: float) -> float:
    """Loss in OEE percentage points: 1 planned minute = 1 ideal piece."""
    return 100 * loss_pcs / plan_min if plan_min else 0.0


def severity_by_pp(loss_pp: float) -> str:
    return "high" if loss_pp >= 0.5 else "medium" if loss_pp >= 0.2 else "low"


def severity_by_z(z: float) -> str:
    return "high" if abs(z) >= 3 else "medium"


def num(value: float) -> str:
    """At most one decimal, no trailing zero: 25, 7.3."""
    return f"{value:.1f}".removesuffix(".0")


def fmt_day(date) -> str:
    return f"{date:%b} {date.day}"


def fmt_days(dates) -> str:
    """Nov 4, 11, 18, 25 — the month is written once per run of days."""
    out, month = [], None
    for date in sorted(dates):
        out.append(str(date.day) if date.month == month else fmt_day(date))
        month = date.month
    return ", ".join(out)


def hour_range(hour: int) -> str:
    start = SHIFT_START_HOUR + hour - 1
    return f"{start:02d}:00–{start + 1:02d}:00"


def insight(*, id, kind, severity, title, evidence, code, loss_pcs, loss_pp,
            expected_at=None, keys=()) -> dict:
    """One /api/insights item. `_keys` are countermeasure lookup keys, removed by the engine."""
    return {
        "id": id,
        "kind": kind,
        "severity": severity,
        "title": title,
        "evidence": evidence,
        "code": code,
        "loss_pcs": round(float(loss_pcs), 1),
        "loss_pp": round(float(loss_pp), 2),
        "expected_at": expected_at,
        "recommendation": None,
        "_keys": [k for k in keys if k],
    }
