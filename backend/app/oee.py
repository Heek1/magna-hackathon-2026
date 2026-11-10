"""OEE and loss calculations. Always from sums, never by averaging percentages.

Ideal cycle is 60 s, so 1 planned minute = 1 ideal piece and loss minutes = loss pieces.
"""
from __future__ import annotations

import pandas as pd

TARGET_OEE = 0.85


def _ratio(num: float, den: float) -> float:
    return float(num) / float(den) if den else 0.0


def kpis(hours: pd.DataFrame) -> dict:
    """Shift-like KPI block for any set of hour rows."""
    plan = hours["Plan_min"].sum()
    run = hours["Chod_min"].sum()
    produced = hours["Vyrobene_ks"].sum()
    ok = hours["OK_ks"].sum()
    a, p, q = _ratio(run, plan), _ratio(produced, run), _ratio(ok, produced)
    return {
        "plan_min": round(float(plan), 1),
        "run_min": round(float(run), 1),
        "downtime_min": round(float(hours["Prestoj_min"].sum()), 1),
        "produced": round(float(produced), 1),
        "ok": round(float(ok), 1),
        "nok": round(float(hours["NOK_ks"].sum()), 1),
        "availability": round(a, 4),
        "performance": round(p, 4),
        "quality": round(q, 4),
        "oee": round(a * p * q, 4),
        "target": TARGET_OEE,
    }


def _between(df: pd.DataFrame, col: str, date_from, date_to) -> pd.DataFrame:
    dates = pd.to_datetime(df[col]).dt.normalize()
    mask = pd.Series(True, index=df.index)
    if date_from is not None:
        mask &= dates >= pd.Timestamp(date_from)
    if date_to is not None:
        mask &= dates <= pd.Timestamp(date_to)
    return df[mask]


def history(hours: pd.DataFrame, date_from=None, date_to=None) -> list[dict]:
    hours = _between(hours, "Datum", date_from, date_to)
    out = []
    for date, day in hours.groupby(hours["Datum"].dt.date, sort=True):
        k = kpis(day)
        out.append({
            "date": date.isoformat(),
            "availability": k["availability"],
            "performance": k["performance"],
            "quality": k["quality"],
            "oee": k["oee"],
            "downtime_min": k["downtime_min"],
            "nok": k["nok"],
        })
    return out


HEATMAP_METRICS = ("oee", "performance", "downtime")


def heatmap(hours: pd.DataFrame, metric: str) -> list[dict]:
    if metric not in HEATMAP_METRICS:
        raise ValueError(f"metric must be one of {HEATMAP_METRICS}")
    out = []
    for _, row in hours.iterrows():
        if metric == "downtime":
            value = round(float(row["Prestoj_min"]), 1)
        else:
            value = kpis(row.to_frame().T)["oee" if metric == "oee" else "performance"]
        out.append({"date": row["Datum"].date().isoformat(), "hour": int(row["Hodina_zmeny"]),
                    "value": value})
    return out


SPEED_LOSSES = (
    ("microstop", "Mikrostop_s", "Microstops", None),
    ("retest", "Retest_cas_s", "Retests", "Retesty_pocet"),
    ("slowdown", "Spomalenie_s", "Slowdown", None),
)


def losses(hours: pd.DataFrame, downtime: pd.DataFrame, nok: pd.DataFrame,
           date_from=None, date_to=None) -> list[dict]:
    """Losses in pieces: downtime by (Kod_chyby, Zariadenie), speed split, scrap by Kod_chyby."""
    hours = _between(hours, "Datum", date_from, date_to)
    hour_ids = set(hours["Hodina_ID"])
    downtime = downtime[downtime["Hodina_ID"].isin(hour_ids)]
    nok = nok[nok["Hodina_ID"].isin(hour_ids)]
    ideal = float(hours["Plan_min"].sum())

    def item(type_, code, device, description, pcs, count):
        return {"type": type_, "code": code, "device": device, "description": description,
                "loss_pcs": round(float(pcs), 1), "loss_pp": round(_ratio(pcs, ideal) * 100, 2),
                "count": int(count)}

    out = []
    for (code, device), g in downtime.groupby(["Kod_chyby", "Zariadenie"]):
        out.append(item("downtime", code, device, g["Popis_EN"].iloc[0], g["Trvanie_min"].sum(), len(g)))
    for type_, col, description, count_col in SPEED_LOSSES:
        pcs = hours[col].sum() / 60
        count = hours[count_col].sum() if count_col else (hours[col] > 0).sum()
        if pcs > 0:
            out.append(item(type_, type_, None, description, pcs, count))
    for code, g in nok.groupby("Kod_chyby"):
        out.append(item("nok", code, None, g["Popis_EN"].iloc[0], g["NOK_ks"].sum(), len(g)))
    return sorted(out, key=lambda x: x["loss_pcs"], reverse=True)
