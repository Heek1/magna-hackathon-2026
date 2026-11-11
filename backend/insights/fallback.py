"""Answers from our own data when the LLM is down or slow, so "Ask AI" never goes blank in a demo.

answer(question, snapshot, code, role, followups, lang) -> {answer, sources, followups} or None.
Built only from the snapshot the LLM would have seen (chat.build_snapshot), so every number is the
same one the screens show. Covers the starter questions and the Error detail questions, in English
and Slovak; anything else returns None and the API answers 503 as before.
"""
from __future__ import annotations

import re

from .lang import (EN, SK, UK, SK_CONFIDENCE, SK_DAY_EVERY, SK_DAY_ON, SK_SPEED, fold, num, sk_when)
from .common import WEEKDAYS

SOURCE = {EN: "Engine data", SK: "Dáta systému", UK: "Дані лінії"}
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


# ---------- "tell me about the project", "what can you do" ----------

ABOUT = {
    EN: ("about the project", "about this", "about the app", "about you", "what can you do", "what do you do",
         "who are you", "what are you", "what is this", "tell me about", "overview", "introduce", "help me",
         "how does it work"),
    SK: ("o projekte", "o aplikacii", "o sebe", "co vies", "co dokazes", "co robis", "kto si",
         "co je to", "povedz mi o", "predstav", "pomoc", "ako to funguje", "prehlad"),
    UK: ("проєкт", "проект", "розкаж", "роскаж", "що ти", "хто ти", "що це", "що вмієш", "що можеш",
         "допомож", "як це працює", "огляд", "про себе"),
}


def about_lang(question: str, lang: str) -> str | None:
    """The language of a general question about the app or the line ("tell me about the project",
    "Povedz mi o projekte" even without diacritics), or None for any other question."""
    q = fold(question)
    if re.search(r"\b(st|q)-\d+", q):  # "tell me about ST-038" is a question about that error
        return None
    if q.strip(" ?!.") in ("help", "hi", "hello", "hey"):
        return EN
    if q.strip(" ?!.") in ("pomoc", "ahoj"):
        return SK
    if q.strip(" ?!.") in ("привіт", "допомога"):
        return UK
    for candidate in (lang, EN, SK, UK):
        if any(w in q for w in ABOUT[candidate]):
            return candidate
    return None


def is_about(question: str, lang: str) -> bool:
    return about_lang(question, lang) is not None


def overview(snapshot: dict, lang: str, followups: list[str] | None = None) -> dict | None:
    """What the app is, the month in three facts and the top fix; every number from the snapshot."""
    month = snapshot.get("month")
    if not month:
        return None
    lost = month["lost_pcs"]
    down, nok = month["downtime_min"], month["nok"]
    speed = max(0.0, lost - down - nok)

    def share(value):
        return round(100 * value / lost) if lost else 0

    stops = (snapshot.get("patterns") or {}).get("recurring_stops") or []
    stop = stops[0] if stops else None
    gain = next((g for g in snapshot.get("gains", []) if stop and g["remove"] == [stop["code"]]), None)
    station = stop["what"].split(":")[0] if stop else ""
    target = snapshot.get("target_pct", 85.0)
    if lang == SK:
        text = (f"Som AI asistent OEE Improvement Engine pre linku montáže elektrických pohonov. "
                f"Od {month['from']} do {month['to']} je OEE {_pct(month['oee_pct'], lang)} pri cieli "
                f"{num(target, lang=lang)} %; stratilo sa {num(round(lost))} ks: rýchlosť {share(speed)} %, "
                f"prestoje {share(down)} %, nepodarky {share(nok)} %.")
        if stop:
            text += f" Najväčší opakovaný prestoj je {stop['code']} ({station}), každý {stop['every']}"
            text += f" — jeho odstránenie prinesie {_pp(gain['gain_pp'], lang)}." if gain else "."
        text += " Spýtajte sa ma, prečo prestoj vzniká, čo opraviť ako prvé alebo čo pripraviť na zajtra."
    elif lang == UK:
        text = (f"Я AI-асистент OEE Improvement Engine для лінії складання електроприводів. "
                f"З {month['from']} по {month['to']} OEE {_pct(month['oee_pct'], EN)} при цілі "
                f"{num(target)} %; втрачено {num(round(lost))} шт: швидкість {share(speed)} %, "
                f"простої {share(down)} %, брак {share(nok)} %.")
        if stop:
            text += f" Найбільша повторювана зупинка — {stop['code']} ({station}), щоразу {stop['every']}"
            text += f"; її усунення дасть {_pp(gain['gain_pp'], EN)} OEE." if gain else "."
        text += " Спитайте, чому виникає зупинка, що виправити першим або до чого готуватися завтра."
    else:
        text = (f"I'm the AI assistant of the OEE Improvement Engine for the electric drive assembly line. "
                f"From {month['from']} to {month['to']} OEE is {_pct(month['oee_pct'], lang)} against the "
                f"{num(target)} % target; {num(round(lost))} pcs were lost: speed {share(speed)} %, "
                f"downtime {share(down)} %, scrap {share(nok)} %.")
        if stop:
            text += f" The top recurring stop is {stop['code']} ({station}), every {stop['every']}"
            text += f" — fixing it gives {_pp(gain['gain_pp'], lang)} OEE." if gain else "."
        text += " Ask me why a stop happens, what to fix first, or what to prepare for tomorrow."
    sources = {EN: ["Month OEE", "Losses by type", "Recurring stops"],
               SK: ["OEE za mesiac", "Straty podľa typu", "Opakované prestoje"],
               UK: ["OEE за місяць", "Втрати за типом", "Повторювані зупинки"]}[lang if lang in (SK, UK) else EN]
    return {"answer": text, "sources": sources, "followups": (followups or [])[:3]}
