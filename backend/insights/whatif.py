"""what_if: OEE of a period with selected causes of loss removed."""
from __future__ import annotations

import re

import pandas as pd

from .common import normalize

SPEED_COLUMNS = {"microstop": "Mikrostop_s", "retest": "Retest_cas_s", "slowdown": "Spomalenie_s"}
_SLOW_HOUR = re.compile(r"slow_hour_(\d+)$")


def what_if(data, remove, from_=None, to=None) -> dict:
    """{oee_before, oee_after, gain_pcs, gain_pp} for the period [from_, to] (dates, inclusive).

    remove holds codes or keys:
    - a downtime code: its minutes become run time at the period's Performance and Quality;
    - slow_hour_N: Performance of shift hour N rises to the median of the other hours;
    - microstop / retest / slowdown (the codes of /api/losses): that time produces pieces;
    - a scrap code: its NOK pieces become OK.
    Gains are in good pieces. Unknown keys change nothing. Slow hours are part of the speed
    losses, so together they never recover more than the speed loss of the period.
    """
    ctx = normalize(data)
    hours = ctx.hours
    if from_ is not None:
        hours = hours[hours["date"] >= pd.Timestamp(from_)]
    if to is not None:
        hours = hours[hours["date"] <= pd.Timestamp(to)]

    plan = float(hours["Plan_min"].sum()) if not hours.empty else 0.0
    if not plan:
        return {"oee_before": 0.0, "oee_after": 0.0, "gain_pcs": 0.0, "gain_pp": 0.0}
    run = float(hours["Chod_min"].sum())
    produced = float(hours["Vyrobene_ks"].sum())
    ok = float(hours["OK_ks"].sum())
    performance = produced / run if run else 0.0
    quality = ok / produced if produced else 0.0

    hour_ids = set(hours["Hodina_ID"])
    downtime = ctx.downtime[ctx.downtime["Hodina_ID"].isin(hour_ids)]
    nok = ctx.nok[ctx.nok["Hodina_ID"].isin(hour_ids)]
    by_hour = hours[hours["Chod_min"] > 0].groupby("hour")[["Chod_min", "Vyrobene_ks"]].sum()
    hour_perf = by_hour["Vyrobene_ks"] / by_hour["Chod_min"]

    gain = speed_gain = 0.0
    for key in dict.fromkeys(remove):  # each key once
        slow = _SLOW_HOUR.match(key)
        if slow:
            hour = int(slow.group(1))
            if hour in hour_perf.index and len(hour_perf) > 1:
                lift = hour_perf.drop(hour).median() - hour_perf[hour]
                speed_gain += max(0.0, lift) * by_hour.loc[hour, "Chod_min"] * quality
        elif key in SPEED_COLUMNS:
            speed_gain += hours[SPEED_COLUMNS[key]].sum() / 60 * quality
        elif not downtime.empty and (downtime["Kod_chyby"] == key).any():
            minutes = downtime.loc[downtime["Kod_chyby"] == key, "Trvanie_min"].sum()
            gain += minutes * performance * quality
        elif not nok.empty:
            gain += nok.loc[nok["Kod_chyby"] == key, "NOK_ks"].sum()

    gain = float(gain + min(speed_gain, max(0.0, run - produced) * quality))
    before, after = ok / plan, (ok + gain) / plan
    return {
        "oee_before": round(before, 4),
        "oee_after": round(after, 4),
        "gain_pcs": round(gain, 1),
        "gain_pp": round((after - before) * 100, 2),
    }
