"""Answers from our own data when the LLM is down or slow, so "Ask AI" never goes blank in a demo.

answer(question, snapshot, code, role, followups, lang) -> {answer, sources, followups} or None.
Built only from the snapshot the LLM would have seen (chat.build_snapshot), so every number is the
same one the screens show. Covers the starter questions and the Error detail questions, in English
and Slovak; anything else returns None and the API answers 503 as before.
"""
from __future__ import annotations

import re

from .lang import (EN, SK, SK_CONFIDENCE, SK_DAY_EVERY, SK_DAY_ON, SK_SPEED, fold, num, sk_when)
from .common import WEEKDAYS

SOURCE = {EN: "Engine data", SK: "Dáta systému"}
SPEED_NAMES = {"slowdown": "Slowdown", "microstop": "Microstops", "retest": "Retests"}

# Intent words; Slovak ones are matched on the question without diacritics.
WORDS = {
    "gain": (("gain", "worth", "how much", "save", "recover"), ("ziska", "kolko", "prines", "usetr")),
    "next": (("when", "next", "expect"), ("kedy", "najblizs", "ocakav", "dalsi")),
    "fix": (("do about", "fix", "countermeasure", "should", "prevent"),
            ("urobit", "robit", "opatren", "oprav", "zabran", "ries")),
    "prepare": (("tomorrow", "prepare", "coming up", "expect"), ("zajtra", "priprav", "ocakav")),
    "most": (("most", "biggest", "top", "worst", "cost"), ("najviac", "najvacs", "stoji", "najhors")),
    "today": (("today", "shift", "going", "now"), ("dnes", "zmen", "teraz")),
}


def _has(question: str, intent: str, lang: str) -> bool:
    en, sk = WORDS[intent]
    words = sk if lang == SK else en
    q = fold(question) if lang == SK else question.lower()
    return any(re.search(rf"\b{w}", q) for w in words)


def _pcs(value, lang) -> str:
    return f"{num(value, lang=lang)} {'ks' if lang == SK else 'pcs'}"


def _pp(value, lang) -> str:
    return f"+{num(value, 2, lang)} {'p. b.' if lang == SK else 'pp'}"


def _pct(value, lang) -> str:
    return f"{num(value, 1, lang)} %"


def _speed_or_code(loss: dict, lang: str, with_what: bool = True) -> str:
    if loss["code"] in SPEED_NAMES:
        return SK_SPEED[loss["code"]] if lang == SK else SPEED_NAMES[loss["code"]]
    return loss["code"] + (f" ({loss['what']})" if with_what and loss.get("what") else "")


def _fix_text(fix: dict | None, lang: str) -> str:
    if not fix or not fix.get("action"):
        return ""
    owner = f" ({fix['owner_role']})" if fix.get("owner_role") else ""
    word = "Opatrenie" if lang == SK else "Fix"
    return f" {word}{owner}: {fix['action'].rstrip('.')}."


def _day_index(focus: dict) -> int:
    return WEEKDAYS.index(focus["weekday"])


def _weekday(snapshot: dict, lang: str) -> str | None:
    focus = snapshot.get("focus") or {}
    if "weekday" not in focus or focus.get("oee_pct") is None:
        return None
    if lang == SK:
        n = _day_index(focus)
        text = (f"OEE {SK_DAY_ON[n]} je {_pct(focus['oee_pct'], lang)} oproti "
                f"{_pct(focus['other_days_oee_pct'], lang)} v ostatných dňoch, pri "
                f"{num(focus['downtime_min'], lang=lang)} min prestojov.")
        for stop in focus.get("recurring_stops", [])[:1]:
            time_ = stop["every"].split()[-1]
            seen = stop["seen"].replace(" of ", " zo ").replace(" weeks", " týždňov")
            text += (f" {stop['code']} ({stop['what']}) zastavuje linku {SK_DAY_EVERY[n]} o {time_} ({seen}), "
                     f"doteraz {_pcs(stop['loss_pcs'], lang)}; jeho odstránenie prinesie "
                     f"{_pp(stop['gain_if_fixed']['gain_pp'], lang)} OEE.")
        return text
    text = (f"OEE on {focus['weekday']}s is {_pct(focus['oee_pct'], lang)} against "
            f"{_pct(focus['other_days_oee_pct'], lang)} on the other days, with "
            f"{num(focus['downtime_min'])} min of downtime.")
    for stop in focus.get("recurring_stops", [])[:1]:
        text += (f" {stop['code']} ({stop['what']}) stops every {stop['every']} ({stop['seen']}), "
                 f"{_pcs(stop['loss_pcs'], lang)} so far; fixing it gives {_pp(stop['gain_if_fixed']['gain_pp'], lang)}.")
    return text


def _prepare(snapshot: dict, role: str | None, lang: str) -> str | None:
    upcoming = snapshot.get("upcoming") or []
    if not upcoming:
        return ("V najbližších zmenách sa neočakávajú žiadne opakované prestoje." if lang == SK
                else "No repeating stops are expected in the next shifts.")
    tomorrow = [u for u in upcoming if u["when"].startswith("tomorrow")]
    items = tomorrow or upcoming[:1]
    if role:  # the role's own stops first
        items = sorted(items, key=lambda u: not (u.get("fix") and u["fix"].get("owner_role") == role))
    u = items[0]
    if lang == SK:
        when = sk_when(u["when"])
        head = when[0].upper() + when[1:] if tomorrow else f"Najbližšie {when}"
        return (f"{head}: {u['code']} ({u['what']}) s {SK_CONFIDENCE[u['confidence']]} pravdepodobnosťou, "
                f"ohrozených ~{_pcs(u['risk_pcs'], lang)}.{_fix_text(u.get('fix'), lang)}")
    head = "Tomorrow" if tomorrow else "Next"
    when = u["when"].removeprefix("tomorrow ") if tomorrow else u["when"]
    return (f"{head} {when}: {u['code']} ({u['what']}), {u['confidence']} confidence, "
            f"~{_pcs(u['risk_pcs'], lang)} at risk.{_fix_text(u.get('fix'), lang)}")


def _most(snapshot: dict, lang: str) -> str | None:
    top = snapshot.get("top_losses") or []
    if not top:
        return None
    first, rest = top[0], top[1:3]
    if lang == SK:
        text = f"Najviac nás stojí {_speed_or_code(first, lang)}: {_pcs(first['loss_pcs'], lang)} za tento mesiac."
        if rest:
            text += " Nasledujú " + " a ".join(
                f"{_speed_or_code(t, lang, False)} ({_pcs(t['loss_pcs'], lang)})" for t in rest) + "."
        return text
    name = _speed_or_code(first, lang)
    text = f"{name[0].upper() + name[1:]} costs the most: {_pcs(first['loss_pcs'], lang)} this month."
    if rest:
        text += " Then " + " and ".join(f"{_speed_or_code(t, lang, False)} {_pcs(t['loss_pcs'], lang)}" for t in rest) + "."
    return text


def _today(snapshot: dict, lang: str) -> str | None:
    today = snapshot.get("today")
    if not today:
        return None
    target = snapshot.get("target_pct", 85.0)
    gap = today.get("vs_target_pp", round(today["oee_pct"] - target, 1))
    if lang == SK:
        side = "nad" if gap >= 0 else "pod"
        return (f"Dnešné OEE je {_pct(today['oee_pct'], lang)} ({num(abs(gap), lang=lang)} p. b. {side} cieľom "
                f"{num(target, lang=lang)} %): doteraz {_pcs(today['lost_pcs'], lang)} strát a "
                f"{num(today['downtime_min'], lang=lang)} min prestojov.")
    side = "above" if gap >= 0 else "below"
    return (f"Today's OEE is {_pct(today['oee_pct'], lang)} ({num(abs(gap))} pp {side} the {num(target)} % target): "
            f"{_pcs(today['lost_pcs'], lang)} lost and {num(today['downtime_min'])} min of downtime so far.")


def _sk_why(focus: dict) -> str:
    """Why an error happens, in Slovak, from the focus facts."""
    code, lang = focus["code"], SK
    when = focus.get("when") or []
    if focus.get("type") == "stop" and len(when) == 1 and int(when[0].split("×")[-1]) >= 2:
        day, time_, times = when[0].split()
        n = [d[:3] for d in WEEKDAYS].index(day)
        return (f"{code} zastavuje linku {SK_DAY_EVERY[n]} o {time_} ({times.lstrip('×')}-krát), spolu "
                f"{num(focus['minutes'], lang=lang)} min a {_pcs(focus['loss_pcs'], lang)} — pravidelný vzorec, "
                f"nie náhodné opotrebenie.")
    what = f" ({focus['what']})" if focus.get("what") else ""
    return (f"{code}{what}: {focus.get('count', 0)}-krát, {_pcs(focus['loss_pcs'], lang)} strát, "
            f"{num(focus['loss_pp'], 2, lang)} p. b. OEE.")


def _code(question: str, focus: dict, snapshot: dict, lang: str) -> str | None:
    """Questions on Error detail: gain, why, when next, what to do."""
    code = focus["code"]
    sk = lang == SK
    if "note" in focus:
        return f"{code} sa v dátach zatiaľ nevyskytol." if sk else f"{code} has not occurred in the data so far."
    gain = focus.get("gain_if_fixed") or {}
    if _has(question, "gain", lang):
        before = (snapshot.get("month") or {}).get("oee_pct")
        change = f": OEE {_pct(before, lang)} → {_pct(gain['oee_after_pct'], lang)}" if before is not None else ""
        if sk:
            return f"Odstránenie {code} prinesie {_pp(gain['gain_pp'], lang)} OEE ({_pcs(gain['gain_pcs'], lang)}){change}."
        return f"Fixing {code} gives {_pp(gain['gain_pp'], lang)} OEE ({_pcs(gain['gain_pcs'], lang)}){change}."
    if _has(question, "next", lang):
        nxt = focus.get("next")
        if sk:
            return (f"{code} sa najbližšie očakáva {sk_when(nxt['when'])} s {SK_CONFIDENCE[nxt['confidence']]} "
                    f"pravdepodobnosťou." if nxt else f"{code} nemá pravidelný čas, ďalší prestoj preto nepredpovedáme.")
        return (f"{code} is expected next {nxt['when']} ({nxt['confidence']} confidence)." if nxt
                else f"{code} has no repeating time, so no next stop is predicted.")
    if _has(question, "fix", lang):
        text = _fix_text(focus.get("fix"), lang).strip()
        return text or (f"Pre {code} zatiaľ nie je opatrenie." if sk else f"There is no countermeasure for {code} yet.")
    if sk:
        return _sk_why(focus)
    if focus.get("why"):
        return focus["why"]
    return (f"{code} ({focus.get('what', focus.get('type'))}): {focus.get('count', 0)} times, "
            f"{_pcs(focus['loss_pcs'], lang)} lost, {focus['loss_pp']:g} pp of OEE.")


def answer(question: str, snapshot: dict, code: str | None = None, role: str | None = None,
           followups: list[str] | None = None, lang: str = EN) -> dict | None:
    """A short deterministic answer from the snapshot, or None when the question is not covered."""
    if "note" in snapshot and "today" not in snapshot:  # no data yet
        return None
    focus = snapshot.get("focus") or {}
    text = None
    if code and focus.get("code") == code:
        text = _code(question, focus, snapshot, lang)
    elif "weekday" in focus:
        text = _weekday(snapshot, lang)
    elif _has(question, "prepare", lang):
        text = _prepare(snapshot, role, lang)
    elif _has(question, "most", lang):
        text = _most(snapshot, lang)
    elif _has(question, "today", lang):
        text = _today(snapshot, lang)
    if not text:
        return None
    return {"answer": text, "sources": [SOURCE[lang]],
            "followups": [q for q in (followups or []) if q.strip().lower() != question.strip().lower()][:3]}
