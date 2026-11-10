"""explain: one plain-English explanation per error code, for the Error detail screen."""
from __future__ import annotations

from .common import WEEKDAYS, Context, normalize, num
from .detectors import _clock, _recurring_patterns, anomaly, quality, slow_hour
from .whatif import SPEED_COLUMNS

MAX_CHARS = 220
STATIONS = {"Kamera": "camera", "Zasobovanie": "material supply", "Nastroj": "tool"}
SPEED_NAMES = {"microstop": "Microstops cost", "retest": "Retests cost", "slowdown": "Slowdown costs"}


def explain(data, code: str) -> str | None:
    """1-2 sentences, at most 220 characters: how often, when, how long, where, and a link to a
    slow hour or to today's anomaly. None when there is nothing to say (fewer than 2 occurrences).
    Works for stop codes, defect codes and microstop / retest / slowdown.
    """
    ctx = normalize(data)
    if ctx.hours.empty:
        return None
    if code in SPEED_COLUMNS:
        sentences = _speed(ctx, code)
    elif not ctx.downtime.empty and (ctx.downtime["Kod_chyby"] == code).any():
        sentences = _stop(ctx, code)
    elif not ctx.nok.empty and (ctx.nok["Kod_chyby"] == code).any():
        sentences = _defect(ctx, code)
    else:
        return None
    if not sentences:
        return None
    text = " ".join(sentences)
    return text if len(text) <= MAX_CHARS else sentences[0][:MAX_CHARS]


def _slow_hours(ctx: Context) -> set[int]:
    return {int(i["code"].rsplit("_", 1)[1]) for i in slow_hour(ctx)}


def _stop(ctx: Context, code: str) -> list[str]:
    rows = ctx.downtime[ctx.downtime["Kod_chyby"] == code]
    if len(rows) < 2:
        return []
    finished = rows if ctx.sim_time is None else rows[rows["Cas_do"] < ctx.sim_time]
    typical = num((finished if len(finished) else rows)["Trvanie_min"].median())
    device = rows["Zariadenie"].iloc[0]
    station = STATIONS.get(device, str(device).lower())

    behind_anomaly = any(i["code"] == code for i in anomaly(ctx))
    slow_hours = _slow_hours(ctx)
    patterns = [p for p in _recurring_patterns(ctx) if p["code"] == code]
    if patterns:
        p = max(patterns, key=lambda p: len(p["dates"]))
        first = (f"Stops every {WEEKDAYS[p['weekday']]} at {_clock(p['start_min'])} "
                 f"({len(p['dates'])} of {p['opportunities']} weeks), about {typical} min each, at the "
                 f"{station} station — a scheduled pattern, not random wear.")
        if behind_anomaly:
            return [first, f"It is behind the abnormally low OEE of the current hour ({ctx.cur_hour})."]
        if p["hour"] in slow_hours:
            return [first, f"Hour {p['hour']} is also a consistently slow hour."]
        return [first]

    first = (f"{len(rows)} stops on {rows['date'].nunique()} days, about {typical} min each, at the "
             f"{station} station.")
    if behind_anomaly:
        return [first, f"No fixed schedule; it is behind the abnormally low OEE of the current hour "
                       f"({ctx.cur_hour})."]
    by_hour = rows.groupby("hour").size()
    if by_hour.max() < 2:
        return [first, "No fixed schedule, it looks random."]
    top_hour = int(by_hour.idxmax())
    slow = ", a consistently slow hour" if top_hour in slow_hours else ""
    return [first, f"No fixed schedule; most often in shift hour {top_hour} "
                   f"({by_hour.max()} of {len(rows)}){slow}."]


def _defect(ctx: Context, code: str) -> list[str]:
    rows = ctx.nok[ctx.nok["Kod_chyby"] == code]
    if len(rows) < 2:
        return []
    pcs = rows["NOK_ks"].sum()
    days, all_days = rows["date"].nunique(), ctx.hours["date"].nunique()
    character = "a steady defect, not a one-off" if days / all_days >= 0.5 else "it comes in bursts"
    first = (f"{num(pcs)} NOK pcs, {pcs / ctx.nok['NOK_ks'].sum():.0%} of all scrap, on {days} of "
             f"{all_days} days — {character}.")

    spike = next((i for i in quality(ctx) if i["id"].startswith(f"quality:spike:{code}:")), None)
    if spike:
        today = rows.loc[rows["date"] == ctx.today, "NOK_ks"].sum()
        return [first, f"Today it spiked: {num(today)} pcs, {num(spike['loss_pcs'])} above a normal shift."]
    by_hour = rows.groupby("hour")["NOK_ks"].sum()
    top_hour = int(by_hour.idxmax())
    if by_hour.max() / pcs < 0.2:
        return [first, "Spread evenly over the shift, no peak hour."]
    slow = ", a consistently slow hour" if top_hour in _slow_hours(ctx) else ""
    return [first, f"Most in shift hour {top_hour} ({num(by_hour.max())} of {num(pcs)} pcs){slow}."]


def _speed(ctx: Context, code: str) -> list[str]:
    column = SPEED_COLUMNS[code]
    hours = ctx.hours[ctx.hours["Chod_min"] > 0]
    if (hours[column] > 0).sum() < 2:
        return []
    sums = hours.groupby("hour")[[column, "Chod_min"]].sum()
    rate = sums[column] / sums["Chod_min"]
    overall = hours[column].sum() / hours["Chod_min"].sum()
    first = f"{SPEED_NAMES[code]} {num(hours[column].sum() / 60)} pcs, {overall:.1f} s per run minute."

    slow = sorted(h for h in _slow_hours(ctx) if h in rate.index and rate[h] > overall)
    if slow:
        others = sums.drop(slow)
        elsewhere = others[column].sum() / others["Chod_min"].sum()
        where = " and ".join(str(h) for h in slow)
        rates = " and ".join(f"{rate[h]:.1f}" for h in slow)
        plural = "s" if len(slow) > 1 else ""
        return [first, f"Worst in the slow shift hour{plural} {where}: {rates} s/min vs {elsewhere:.1f} elsewhere."]
    top = int(rate.idxmax())
    return [first, f"Highest in shift hour {top}: {rate[top]:.1f} s/min."]
