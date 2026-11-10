"""Daily report for /api/report: KPIs, top losses, insights, actions and a text summary."""
from __future__ import annotations

from datetime import date

from . import oee

TOP_LOSSES = 5


def build(day: date, hours, downtime, nok, insights: list[dict], actions: list[dict]) -> dict:
    day_hours = hours[hours["Datum"].dt.date == day]
    kpis = oee.kpis(day_hours)
    top = oee.losses(hours, downtime, nok, day, day)[:TOP_LOSSES]
    return {
        "date": day.isoformat(),
        "kpis": kpis,
        "top_losses": top,
        "insights": insights,
        "actions": actions,
        "summary": _summary(day, kpis, top, insights, actions),
    }


def _summary(day: date, k: dict, top: list[dict], insights: list[dict], actions: list[dict]) -> str:
    gap_pp = (k["oee"] - k["target"]) * 100
    verdict = "above" if gap_pp >= 0 else "below"
    parts = [
        f"{day.strftime('%A %Y-%m-%d')}: OEE {k['oee'] * 100:.1f} % ({abs(gap_pp):.1f} pp {verdict} "
        f"the {k['target'] * 100:.0f} % target) — availability {k['availability'] * 100:.1f} %, "
        f"performance {k['performance'] * 100:.1f} %, quality {k['quality'] * 100:.1f} %.",
        f"Produced {k['produced']:g} pcs, {k['ok']:g} OK, {k['nok']:g} NOK, "
        f"{k['downtime_min']:g} min downtime.",
    ]
    if top:
        losses = "; ".join(
            f"{t['code']}{' (' + t['device'] + ')' if t['device'] else ''} {t['loss_pcs']:g} pcs"
            for t in top[:3])
        parts.append(f"Top losses: {losses}.")
    if insights:
        parts.append(f"{len(insights)} insight(s), highest impact: {insights[0]['title']}.")
    open_actions = sum(1 for a in actions if a["status"] != "done")
    parts.append(f"Actions: {len(actions)} total, {open_actions} not done.")
    return " ".join(parts)
