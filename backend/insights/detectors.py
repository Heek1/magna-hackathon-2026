"""Rule and statistics based detectors. Each returns a list of insights without recommendations."""
from __future__ import annotations

import pandas as pd

from .common import (WEEKDAYS, Context, fmt_day, fmt_days, hour_range, insight, num, pp,
                     severity_by_pp, severity_by_z)

# recurring_stop: same code, weekday and shift hour
RECUR_MIN_COUNT = 2
RECUR_MIN_RATE = 0.75
# slow_hour
SLOW_MIN_GAP = 0.03       # performance below the median of the other hours
SLOW_MIN_DAY_SHARE = 0.7  # share of days on which the hour is below the reference
SLOW_MIN_DAYS = 3
# quality
PARETO_TOP = 3
SPIKE_MIN_PCS = 3
# anomaly and scrap spike
Z_LIMIT = 2.0
MIN_HISTORY_DAYS = 5
ANOMALY_MIN_RUN_MIN = 10


def _recurring_patterns(ctx: Context, min_rate: float = RECUR_MIN_RATE) -> list[dict]:
    """Downtime codes that repeat on the same weekday and shift hour."""
    down = ctx.downtime
    if down.empty:
        return []
    patterns = []
    weekday = down["date"].dt.day_of_week
    for (code, wd, hour), rows in down.groupby(["Kod_chyby", weekday, "hour"]):
        dates = sorted(set(rows["date"]))  # Timestamps
        if len(dates) < RECUR_MIN_COUNT:
            continue
        # Opportunities: past shifts of this weekday that reached this hour, plus today
        # only if the stop has already happened (otherwise today would dilute the rate).
        reached = ctx.hours[(ctx.hours["hour"] == hour) & (ctx.hours["date"].dt.day_of_week == wd)]
        opportunities = set(reached.loc[reached["date"] < ctx.today, "date"]) | set(dates)
        if len(dates) / len(opportunities) < min_rate:
            continue
        # a stop still running at sim_time has Trvanie_min clipped, so it is not a full occurrence
        finished = rows if ctx.sim_time is None else rows[rows["Cas_do"] < ctx.sim_time]
        start_min = (rows["Cas_od"] - rows["date"]).dt.total_seconds().median() / 60
        patterns.append({
            "code": code,
            "weekday": int(wd),
            "hour": int(hour),
            "dates": dates,
            "opportunities": len(opportunities),
            "start_min": int(round(start_min)),
            "durations": rows["Trvanie_min"].tolist(),
            "finished_durations": finished["Trvanie_min"].tolist(),
            "device": rows["Zariadenie"].iloc[0],
            "description": rows["Popis_EN"].iloc[0],
        })
    return patterns


def _clock(start_min: int) -> str:
    return f"{start_min // 60:02d}:{start_min % 60:02d}"


def _duration_text(durations: list) -> str:
    if len(set(durations)) == 1:
        return f"{num(durations[0])} min each"
    # the median ignores a stop that is still running (its Trvanie_min is clipped to sim_time)
    return f"typically {num(pd.Series(durations).median())} min"


def recurring_stop(ctx: Context) -> list[dict]:
    out = []
    for p in _recurring_patterns(ctx):
        day = WEEKDAYS[p["weekday"]]
        total = float(sum(p["durations"]))
        loss_pp = pp(total, ctx.plan_period)
        out.append(insight(
            id=f"recurring_stop:{p['code']}:{day[:3].lower()}:{p['hour']}",
            kind="recurring_stop",
            severity=severity_by_pp(loss_pp),
            title=f"{p['code']} {p['description']} repeats every {day} in shift hour {p['hour']}",
            evidence=(f"{len(p['dates'])} of {p['opportunities']} {day}s ({fmt_days(p['dates'])}) "
                      f"at {_clock(p['start_min'])} on {p['device']}, {_duration_text(p['durations'])}: "
                      f"{num(total)} min of downtime = {num(total)} pcs lost, {loss_pp:.2f} pp of OEE "
                      f"over the period."),
            code=p["code"],
            loss_pcs=total,
            loss_pp=loss_pp,
            keys=[p["code"], "recurring_stop"],
        ))
    return out


def prediction(ctx: Context) -> list[dict]:
    """A recurring stop of today's weekday that has not happened yet."""
    if ctx.today is None:
        return []
    out = []
    for p in _recurring_patterns(ctx):
        if p["weekday"] != ctx.today.weekday() or ctx.today in p["dates"]:
            continue
        expected_at = ctx.today + pd.Timedelta(minutes=p["start_min"])
        if ctx.sim_time is not None:
            if ctx.sim_time >= expected_at:
                continue
        elif ctx.cur_hour > p["hour"]:
            continue
        day = WEEKDAYS[p["weekday"]]
        expected = float(pd.Series(p["durations"]).median())
        loss_pp = pp(expected, ctx.plan_day)
        out.append(insight(
            id=f"prediction:{p['code']}:{ctx.today:%Y-%m-%d}",
            kind="prediction",
            severity="high",
            title=(f"Expected today at {_clock(p['start_min'])}: {p['code']} "
                   f"{p['description']} ({p['device']})"),
            evidence=(f"Happened on {len(p['dates'])} of {p['opportunities']} previous {day}s "
                      f"({fmt_days(p['dates'])}) at {_clock(p['start_min'])}, "
                      f"{_duration_text(p['durations'])}. Expected loss {num(expected)} min = "
                      f"{num(expected)} pcs, {loss_pp:.1f} pp of today's OEE."),
            code=p["code"],
            loss_pcs=expected,
            loss_pp=loss_pp,
            expected_at=expected_at.isoformat(),
            keys=[p["code"], "prediction"],
        ))
    return out


def slow_hour(ctx: Context) -> list[dict]:
    """Shift hours whose Performance is consistently below the other hours."""
    hours = ctx.hours
    if hours.empty:
        return []
    hours = hours[hours["Chod_min"] > 0]
    if hours["date"].nunique() < SLOW_MIN_DAYS:
        return []
    sums = hours.groupby("hour")[["Chod_min", "Vyrobene_ks", "Mikrostop_s", "Spomalenie_s"]].sum()
    if len(sums) < 3:
        return []
    perf = sums["Vyrobene_ks"] / sums["Chod_min"]
    overall = perf.median()

    out = []
    for hour in sums.index:
        others = sums.drop(hour)
        reference = perf.drop(hour).median()
        gap = reference - perf[hour]
        if gap <= SLOW_MIN_GAP:
            continue
        rows = hours[hours["hour"] == hour]
        days_below = int((rows["Vyrobene_ks"] / rows["Chod_min"] < overall).sum())
        if days_below / len(rows) < SLOW_MIN_DAY_SHARE:
            continue
        run_min = sums.loc[hour, "Chod_min"]
        loss = gap * run_min
        loss_pp = pp(loss, ctx.plan_period)
        micro = sums.loc[hour, "Mikrostop_s"] / run_min
        slow = sums.loc[hour, "Spomalenie_s"] / run_min
        micro_others = others["Mikrostop_s"].sum() / others["Chod_min"].sum()
        slow_others = others["Spomalenie_s"].sum() / others["Chod_min"].sum()
        key = f"slow_hour_{hour}"
        out.append(insight(
            id=f"slow_hour:{hour}",
            kind="slow_hour",
            severity=severity_by_pp(loss_pp),
            title=(f"Shift hour {hour} ({hour_range(hour)}) is consistently slow: "
                   f"{perf[hour]:.1%} performance vs {reference:.1%}"),
            evidence=(f"Performance {perf[hour]:.1%} vs {reference:.1%} median of the other hours, "
                      f"below the line median on {days_below} of {len(rows)} days "
                      f"({fmt_day(rows['date'].min())} – {fmt_day(rows['date'].max())}). "
                      f"Microstops {micro:.1f} s per run minute vs {micro_others:.1f}, "
                      f"slowdown {slow:.1f} vs {slow_others:.1f}. "
                      f"{loss:.0f} pcs lost, {loss_pp:.2f} pp of OEE over the period."),
            code=key,
            loss_pcs=loss,
            loss_pp=loss_pp,
            keys=[key, "slow_hour"],
        ))
    return out


def quality(ctx: Context) -> list[dict]:
    """Pareto of scrap codes and a spike of a code today against its daily average."""
    nok = ctx.nok
    if nok.empty:
        return []
    out = []
    description = nok.groupby("Kod_chyby")["Popis_EN"].first()
    by_code = nok.groupby("Kod_chyby")["NOK_ks"].sum().sort_values(ascending=False, kind="stable")
    total = float(by_code.sum())
    days = ctx.hours["date"].nunique()
    first, last = ctx.hours["date"].min(), ctx.hours["date"].max()

    cumulative = 0.0
    for rank, (code, pcs) in enumerate(by_code.head(PARETO_TOP).items(), start=1):
        cumulative += pcs
        loss_pp = pp(pcs, ctx.plan_period)
        out.append(insight(
            id=f"quality:pareto:{code}",
            kind="quality",
            severity=severity_by_pp(loss_pp),
            title=f"{code} {description[code]}: #{rank} scrap cause, {pcs / total:.0%} of all NOK",
            evidence=(f"{num(pcs)} of {num(total)} NOK pcs ({pcs / total:.1%}, cumulative "
                      f"{cumulative / total:.1%}) over {days} shifts, {fmt_day(first)} – "
                      f"{fmt_day(last)}; {loss_pp:.2f} pp of OEE over the period."),
            code=code,
            loss_pcs=pcs,
            loss_pp=loss_pp,
            keys=[code, "quality"],
        ))

    # Spike: today's count of a code against its daily counts on the previous days.
    past_dates = sorted(d for d in set(ctx.hours["date"]) if d < ctx.today)
    if len(past_dates) >= MIN_HISTORY_DAYS:
        daily = nok.groupby(["Kod_chyby", "date"])["NOK_ks"].sum()
        for code in by_code.index:
            counts = daily[code]
            today_pcs = float(counts.get(ctx.today, 0))
            history = counts.reindex(past_dates, fill_value=0)
            mean, std = history.mean(), history.std()
            if today_pcs < SPIKE_MIN_PCS or not std > 0 or today_pcs <= mean + Z_LIMIT * std:
                continue
            z = (today_pcs - mean) / std
            loss = today_pcs - mean
            loss_pp = pp(loss, ctx.plan_day)
            out.append(insight(
                id=f"quality:spike:{code}:{ctx.today:%Y-%m-%d}",
                kind="quality",
                severity=severity_by_z(z),
                title=f"{code} {description[code]}: scrap spike today, {num(today_pcs)} pcs",
                evidence=(f"{num(today_pcs)} NOK pcs on {fmt_day(ctx.today)} vs {mean:.1f} per shift on "
                          f"average over the previous {len(past_dates)} shifts (σ {std:.1f}, "
                          f"z = {z:+.1f}). {loss:.1f} pcs above normal, {loss_pp:.1f} pp of "
                          f"today's OEE."),
                code=code,
                loss_pcs=loss,
                loss_pp=loss_pp,
                keys=[code, "quality"],
            ))
    return out


def anomaly(ctx: Context) -> list[dict]:
    """Current hour whose OEE or microstops deviate from the norm of that shift hour."""
    hours = ctx.hours
    if hours.empty or not ctx.cur_hour:
        return []
    current = hours[(hours["date"] == ctx.today) & (hours["hour"] == ctx.cur_hour)].iloc[0]
    history = hours[(hours["hour"] == ctx.cur_hour) & (hours["date"] < ctx.today)]
    history = history[(history["Plan_min"] > 0) & (history["Chod_min"] > 0)]
    if (current["Chod_min"] < ANOMALY_MIN_RUN_MIN or current["Plan_min"] <= 0
            or len(history) < MIN_HISTORY_DAYS):
        return []
    where = f"Hour {ctx.cur_hour} ({hour_range(ctx.cur_hour)}) on {fmt_day(ctx.today)}"
    day_id = f"{ctx.today:%Y-%m-%d}:{ctx.cur_hour}"
    out = []

    oee = current["OK_ks"] / current["Plan_min"]
    norm = history["OK_ks"] / history["Plan_min"]
    mean, std = norm.mean(), norm.std()
    if std > 0 and (oee - mean) / std < -Z_LIMIT:
        z = (oee - mean) / std
        loss = (mean - oee) * current["Plan_min"]
        loss_pp = pp(loss, ctx.plan_day)
        # The longest stop of the hour is the cause to act on; without a stop there is no single code.
        stops = ctx.downtime
        if not stops.empty:
            stops = stops[(stops["date"] == ctx.today) & (stops["hour"] == ctx.cur_hour)]
        cause, downtime = None, ""
        if not stops.empty:
            top = stops.loc[stops["Trvanie_min"].idxmax()]
            cause = top["Kod_chyby"]
            downtime = (f" Downtime in this hour: {num(current['Prestoj_min'])} min, mainly "
                        f"{cause} {top['Popis_EN']} ({top['Zariadenie']}).")
        out.append(insight(
            id=f"anomaly:oee:{day_id}",
            kind="anomaly",
            severity=severity_by_z(z),
            title=f"OEE of the current hour is abnormally low: {oee:.1%} vs {mean:.1%} norm",
            evidence=(f"{where}: OEE {oee:.1%} vs {mean:.1%} norm of this shift hour over "
                      f"{len(history)} previous shifts (σ {std * 100:.1f} pp, z = {z:+.1f}).{downtime} "
                      f"{loss:.1f} pcs below normal, {loss_pp:.1f} pp of today's OEE."),
            code=cause,
            loss_pcs=loss,
            loss_pp=loss_pp,
            keys=[cause, "anomaly"],
        ))

    micro = current["Mikrostop_s"] / current["Chod_min"]
    norm = history["Mikrostop_s"] / history["Chod_min"]
    mean, std = norm.mean(), norm.std()
    if std > 0 and (micro - mean) / std > Z_LIMIT:
        z = (micro - mean) / std
        loss = (micro - mean) * current["Chod_min"] / 60
        loss_pp = pp(loss, ctx.plan_day)
        out.append(insight(
            id=f"anomaly:microstop:{day_id}",
            kind="anomaly",
            severity=severity_by_z(z),
            title=(f"Microstops in the current hour are abnormally high: "
                   f"{micro:.1f} s per run minute vs {mean:.1f} norm"),
            evidence=(f"{where}: {current['Mikrostop_s']:.0f} s of microstops in "
                      f"{current['Chod_min']:.0f} run minutes = {micro:.1f} s/min vs {mean:.1f} norm "
                      f"of this shift hour over {len(history)} previous shifts (σ {std:.1f}, "
                      f"z = {z:+.1f}). {loss:.1f} pcs above normal, {loss_pp:.1f} pp of today's OEE."),
            code="microstop",  # same code as the microstop row of /api/losses
            loss_pcs=loss,
            loss_pp=loss_pp,
            keys=["microstop", "anomaly"],
        ))
    return out


DETECTORS = [recurring_stop, prediction, slow_hour, quality, anomaly]
