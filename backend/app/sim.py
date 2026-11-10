"""Simulator: replays the dataset at accelerated speed.

sim_time only moves through shift windows present in the data (06:00–14:00 of each Datum).
Everything the API returns is computed from `snapshot(dataset, sim_time)`, i.e. data up to sim_time.

Current incomplete hour:
- planned time starts after the non-planned part at the start of the hour (AM_min / Pauza_min);
- downtime minutes are the real overlap of Prestoje [Cas_od, Cas_do) with the elapsed part;
- run = planned elapsed − downtime elapsed;
- counted values (pieces, retests, microstop/retest/slowdown seconds) are taken proportionally
  to elapsed run minutes, so Performance and Quality of the hour stay as in the data.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import pandas as pd

from .data import Dataset

SCALED_COLUMNS = ("Vyrobene_ks", "OK_ks", "NOK_ks", "Retesty_pocet", "Mikrostop_s", "Retest_cas_s",
                  "Spomalenie_s")


@dataclass
class Snapshot:
    sim_time: datetime
    hours: pd.DataFrame     # Vyroba_hodiny rows up to sim_time (last one may be partial)
    downtime: pd.DataFrame  # Prestoje started before sim_time, Trvanie_min clipped to sim_time
    nok: pd.DataFrame       # NOK_detail of those hours, NOK_ks scaled for the partial hour

    def as_frames(self) -> dict[str, pd.DataFrame]:
        """Input for backend/insights functions: three DataFrames trimmed to sim_time."""
        for df in (self.hours, self.downtime, self.nok):
            df.attrs["sim_time"] = self.sim_time
        return {"hours": self.hours, "downtime": self.downtime, "nok": self.nok}


def _minutes(delta: pd.Timedelta | timedelta) -> float:
    return delta.total_seconds() / 60


def snapshot(ds: Dataset, t: datetime) -> Snapshot:
    t = pd.Timestamp(t)
    dt = ds.downtime[ds.downtime["Cas_od"] < t].copy()
    dt["Cas_do"] = dt["Cas_do"].clip(upper=t)
    dt["Trvanie_min"] = (dt["Cas_do"] - dt["Cas_od"]).dt.total_seconds() / 60

    hours = ds.hours[ds.hours["Cas_od"] < t].copy()
    nok = ds.nok[ds.nok["Hodina_ID"].isin(hours["Hodina_ID"])].copy()

    current = hours["Cas_do"] > t
    if current.any():
        idx = hours.index[current][0]
        row = hours.loc[idx]
        elapsed = _minutes(t - row["Cas_od"])
        non_plan = row["Interval_min"] - row["Plan_min"]  # AM / break at the start of the hour
        plan = max(0.0, elapsed - non_plan)
        down = float(dt.loc[dt["Hodina_ID"] == row["Hodina_ID"], "Trvanie_min"].sum())
        run = max(0.0, plan - down)
        f = run / row["Chod_min"] if row["Chod_min"] else 0.0
        hours[list(SCALED_COLUMNS)] = hours[list(SCALED_COLUMNS)].astype(float)
        for col in ("Plan_min", "Prestoj_min", "Chod_min"):
            hours[col] = hours[col].astype(float)
        hours.loc[idx, ["Plan_min", "Prestoj_min", "Chod_min"]] = [plan, down, run]
        for col in SCALED_COLUMNS:
            hours.loc[idx, col] = row[col] * f
        nok["NOK_ks"] = nok["NOK_ks"].astype(float)
        nok.loc[nok["Hodina_ID"] == row["Hodina_ID"], "NOK_ks"] *= f

    return Snapshot(t.to_pydatetime(), hours.reset_index(drop=True), dt.reset_index(drop=True),
                    nok.reset_index(drop=True))


class Simulator:
    """Holds sim_time, speed (sim seconds per real second) and the paused flag."""

    DEFAULT_SPEED = 60.0

    def __init__(self, ds: Dataset, speed: float = DEFAULT_SPEED, paused: bool = False):
        self.speed = speed
        self.paused = paused
        self.load(ds)

    def load(self, ds: Dataset) -> None:
        self.ds = ds
        days = ds.hours.groupby(ds.hours["Datum"].dt.date)
        self.windows = [(g["Cas_od"].min().to_pydatetime(), g["Cas_do"].max().to_pydatetime())
                        for _, g in days]
        self.sim_time = self.windows[0][0]
        self.version = 0

    def _clamp(self, t: datetime) -> datetime:
        """Move t into a shift window: before/between shifts → next shift start; after data → end."""
        for start, end in self.windows:
            if t < start:
                return start
            if t <= end:
                return t
        return self.windows[-1][1]

    def _set(self, t: datetime) -> None:
        t = self._clamp(t)
        if t != self.sim_time:
            self.sim_time = t
            self.version += 1

    def jump(self, t: datetime) -> None:
        self._set(t)

    def advance(self, real_seconds: float) -> None:
        """Move forward; at the end of a shift continue with the next one, stop at the end of data."""
        if self.paused:
            return
        t = self.sim_time + timedelta(seconds=real_seconds * self.speed)
        for start, end in self.windows:
            if self.sim_time <= end and t > end:
                nxt = [s for s, _ in self.windows if s > end]
                if not nxt:
                    t, self.paused = end, True
                elif self.sim_time == end:
                    t = nxt[0] + (t - end)
                else:
                    t = end
                break
        self._set(t)

    def control(self, speed: float | None = None, jump_to: datetime | None = None,
                paused: bool | None = None) -> None:
        if speed is not None:
            if speed <= 0:
                raise ValueError("speed must be > 0")
            self.speed = float(speed)
        if paused is not None:
            self.paused = bool(paused)
        if jump_to is not None:
            self.jump(jump_to)
        self.version += 1

    def snapshot(self) -> Snapshot:
        return snapshot(self.ds, self.sim_time)

    def active_downtime(self) -> dict | None:
        dt = self.ds.downtime
        t = pd.Timestamp(self.sim_time)
        active = dt[(dt["Cas_od"] <= t) & (dt["Cas_do"] > t)]
        if active.empty:
            return None
        r = active.iloc[0]
        return {"code": r["Kod_chyby"], "device": r["Zariadenie"], "description": r["Popis_EN"],
                "since": r["Cas_od"].isoformat()}
