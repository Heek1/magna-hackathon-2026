"""Error views for the mobile screens: fixes on losses, events of a day, one error in detail.

Times of defects and speed losses are the start of their shift hour (the data has no finer time).
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

from . import oee

FIXES_PATH = Path(__file__).resolve().parent.parent / "insights" / "countermeasures.json"
SPEED_CODES = {code: (col, description) for code, col, description, _ in oee.SPEED_LOSSES}
SPEED_EVENT_MIN_PCS = 1.0  # an hour shows a speed event only from 1 piece lost
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
# Station names in the workbook are Slovak; the API speaks English (the data itself is not changed).
DEVICE_EN = {"Kamera": "Camera", "Nastroj": "Tool", "Zasobovanie": "Part supply"}


def device_en(name):
    return DEVICE_EN.get(name, name) if isinstance(name, str) else name


def load_fixes(path: Path = FIXES_PATH) -> dict[str, dict]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {code: {k: v.get(k) for k in ("action", "method", "owner_role")}
            for code, v in raw.items() if isinstance(v, dict)}


def with_fix(items: list[dict], fixes: dict[str, dict]) -> list[dict]:
    return [{**item, "device": device_en(item["device"]), "fix": fixes.get(item["code"])} for item in items]


def _hour_start(hours: pd.DataFrame) -> dict:
    return dict(zip(hours["Hodina_ID"], hours["Cas_od"]))


def events(hours: pd.DataFrame, downtime: pd.DataFrame, nok: pd.DataFrame,
           day: date, sim_time: datetime) -> list[dict]:
    """Stops, defects and speed losses of one day up to sim_time, newest first."""
    hours = hours[hours["Datum"].dt.date == day]
    ids = set(hours["Hodina_ID"])
    starts = _hour_start(hours)
    out = []

    for _, r in downtime[downtime["Hodina_ID"].isin(ids)].iterrows():
        out.append({"time": r["Cas_od"], "kind": "stop", "code": r["Kod_chyby"],
                    "title": f"{r['Kod_chyby']} {device_en(r['Zariadenie'])}", "detail": r["Popis_EN"],
                    "value": round(float(r["Trvanie_min"]), 1), "unit": "min",
                    "active": bool(r["Cas_do"] >= pd.Timestamp(sim_time))})

    day_nok = nok[nok["Hodina_ID"].isin(ids)]
    for (hid, code), g in day_nok.groupby(["Hodina_ID", "Kod_chyby"], sort=False):
        pcs = float(g["NOK_ks"].sum())
        if pcs <= 0:
            continue
        out.append({"time": starts[hid], "kind": "defect", "code": code,
                    "title": code, "detail": g["Popis_EN"].iloc[0],
                    "value": round(pcs, 1), "unit": "pcs", "active": False})

    for _, r in hours.iterrows():
        parts = {code: float(r[col]) / 60 for code, (col, _) in SPEED_CODES.items()}
        total = sum(parts.values())
        if total < SPEED_EVENT_MIN_PCS:
            continue
        main = max(parts, key=parts.get)
        detail = " · ".join(f"{SPEED_CODES[c][1]} {v:.1f}" for c, v in parts.items() if v >= 0.05)
        out.append({"time": r["Cas_od"], "kind": "speed", "code": main,
                    "title": SPEED_CODES[main][1], "detail": detail,
                    "value": round(total, 1), "unit": "pcs", "active": False})

    out.sort(key=lambda e: e["time"], reverse=True)
    for e in out:
        e["time"] = e["time"].isoformat()
    return out


def _pattern(starts: list[pd.Timestamp]) -> list[dict]:
    counts: dict[tuple[int, int], int] = {}
    for s in starts:
        key = (s.weekday(), s.hour)
        counts[key] = counts.get(key, 0) + 1
    return [{"weekday": WEEKDAYS[wd], "hour": h, "count": n} for (wd, h), n in sorted(counts.items())]


def _next_expected(starts: list[pd.Timestamp], sim_time: datetime) -> str | None:
    """Same weekday and same clock time every time (at least twice) → the next such moment."""
    if len(starts) < 2 or len({(s.weekday(), s.hour, s.minute) for s in starts}) != 1:
        return None
    first = starts[0]
    t = pd.Timestamp(sim_time)
    nxt = t.normalize() + timedelta(days=(first.weekday() - t.weekday()) % 7,
                                    hours=first.hour, minutes=first.minute)
    if nxt <= t:
        nxt += timedelta(days=7)
    return nxt.isoformat()


def detail(code: str, hours: pd.DataFrame, downtime: pd.DataFrame, nok: pd.DataFrame,
           fixes: dict[str, dict], sim_time: datetime, date_from=None, date_to=None) -> dict | None:
    """One error code over a period; None when the code does not occur."""
    hours = oee._between(hours, "Datum", date_from, date_to)
    ids = set(hours["Hodina_ID"])
    starts = _hour_start(hours)
    ideal = float(hours["Plan_min"].sum())

    stops = downtime[(downtime["Kod_chyby"] == code) & downtime["Hodina_ID"].isin(ids)]
    defects = nok[(nok["Kod_chyby"] == code) & nok["Hodina_ID"].isin(ids)]
    if not stops.empty:
        kind, description = "stop", stops["Popis_EN"].iloc[0]
        device = device_en(stops["Zariadenie"].mode().iloc[0])
        occ = [{"start": r["Cas_od"], "minutes": float(r["Trvanie_min"]),
                "pcs": float(r["Trvanie_min"])} for _, r in stops.iterrows()]
    elif not defects.empty:
        kind, device, description = "defect", None, defects["Popis_EN"].iloc[0]
        occ = [{"start": starts[r["Hodina_ID"]], "minutes": None, "pcs": float(r["NOK_ks"])}
               for _, r in defects.iterrows() if r["NOK_ks"] > 0]
    elif code in SPEED_CODES:
        col, description = SPEED_CODES[code]
        kind, device = "speed", None
        occ = [{"start": r["Cas_od"], "minutes": float(r[col]) / 60,
                "pcs": float(r[col]) / 60} for _, r in hours.iterrows() if r[col] > 0]
    else:
        return None
    if not occ:
        return None

    occ.sort(key=lambda o: o["start"])
    pcs = sum(o["pcs"] for o in occ)
    minutes = sum(o["minutes"] or 0 for o in occ) if kind != "defect" else 0.0
    loss_pp = round(pcs / ideal * 100, 2) if ideal else 0.0
    times = [o["start"] for o in occ]
    return {
        "code": code, "kind": kind, "description": description, "device": device,
        "count": len(occ), "minutes": round(minutes, 1), "loss_pcs": round(pcs, 1), "loss_pp": loss_pp,
        "pattern": _pattern(times),
        "occurrences": [{"start": o["start"].isoformat(),
                         "minutes": None if o["minutes"] is None else round(o["minutes"], 1),
                         "pcs": round(o["pcs"], 1)} for o in occ],
        "next_expected": _next_expected(times, sim_time) if kind == "stop" else None,
        "fix": fixes.get(code),
        "gain_pp": loss_pp,  # replaced by what_if for stops in the API
    }
