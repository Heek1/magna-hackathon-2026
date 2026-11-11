"""Slovak or English: the language of a question, and the Slovak words the answers need.

Only two languages matter for the demo (the judges are from Magna Slovakia). Slovak is recognised by
its diacritics or by common Slovak words, so it also works for questions typed without diacritics.
"""
from __future__ import annotations

import re

EN, SK, UK = "en", "sk", "uk"
LANGUAGES = (EN, SK)  # starters and engine answers; UK questions get LLM answers in Ukrainian

SK_LETTERS = set("áäčďéíĺľňóôŕšťúýž")
# Common Slovak words, without diacritics (the question is folded before the check).
SK_WORDS = {
    "preco", "co", "kolko", "ako", "aky", "aka", "ake", "kedy", "kto", "ktora", "ktory", "ktore", "je", "su",
    "sa", "ma", "mame", "nas", "na", "v", "vo", "pre", "pri", "alebo", "nie", "ziskame", "opravime",
    "pripravit", "zajtra", "dnes", "zmena", "zmeny", "udrzba", "udrzbu", "stoji", "najviac", "chyba",
    "chyby", "riesit", "stredu", "streda", "pondelok", "utorok", "stvrtok", "piatok", "nizke", "nizka", "nizky",
    "preco", "robit", "urobit", "ocakava", "najblizsie", "prestoj", "prestoje", "linka", "linky",
}
EN_WORDS = {"the", "is", "what", "why", "how", "which", "when", "should", "we", "do", "does", "of", "on",
            "for", "much", "if", "fix", "low", "tomorrow", "today", "prepare", "costs", "most"}

_FOLD = str.maketrans("áäčďéíĺľňóôŕšťúýž", "aacdeillnoorstuyz")


def fold(text: str) -> str:
    """Lower case without Slovak diacritics: "Prečo" -> "preco"."""
    return text.lower().translate(_FOLD)


def detect(question: str) -> str:
    """"sk" for a Slovak question, "uk" for a Cyrillic one (team tests in Ukrainian), else "en"."""
    if re.search(r"[\u0400-\u04FF]", question):
        return UK
    if SK_LETTERS & set(question.lower()):
        return SK
    words = re.findall(r"[a-z]+", fold(question))
    sk = sum(w in SK_WORDS for w in words)
    en = sum(w in EN_WORDS for w in words)
    return SK if sk > en else EN


# Weekdays: Monday = 0. "v stredu", "každú stredu", short labels for dates.
SK_DAY_ON = ["v pondelok", "v utorok", "v stredu", "vo štvrtok", "v piatok", "v sobotu", "v nedeľu"]
SK_DAY_EVERY = ["každý pondelok", "každý utorok", "každú stredu", "každý štvrtok", "každý piatok",
                "každú sobotu", "každú nedeľu"]
SK_DAY_SHORT = {"Mon": "po", "Tue": "ut", "Wed": "st", "Thu": "št", "Fri": "pi", "Sat": "so", "Sun": "ne"}
# Words that name a weekday in a Slovak question (folded), any case ending.
SK_DAY_STEMS = ["pondel", "utor", "stred", "stvrt", "piat", "sobot", "nedel"]

SK_CONFIDENCE = {"high": "vysokou", "medium": "strednou", "low": "nízkou"}  # "s vysokou pravdepodobnosťou"
SK_ROLES = {"Maintenance": "údržba", "Quality": "kvalita", "Logistics": "logistika",
            "Team leader": "vedúci tímu", "Process engineer": "procesný inžinier"}
SK_SPEED = {"slowdown": "spomalenie", "microstop": "mikroprestoje", "retest": "opakované testy"}

MONTHS = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9,
          "Oct": 10, "Nov": 11, "Dec": 12}


def sk_when(label: str) -> str:
    """The snapshot's "today 09:08" / "tomorrow 08:08" / "Mon 30 Nov 11:08" in Slovak."""
    parts = label.split()
    if parts[0] == "today":
        return f"dnes o {parts[1]}"
    if parts[0] == "tomorrow":
        return f"zajtra o {parts[1]}"
    if len(parts) == 4 and parts[0] in SK_DAY_SHORT and parts[2] in MONTHS:
        day = SK_DAY_ON[list(SK_DAY_SHORT).index(parts[0])]
        return f"{day} {int(parts[1])}. {MONTHS[parts[2]]}. o {parts[3]}"
    return label


def num(value, decimals: int | None = None, lang: str = EN) -> str:
    """A number as the language writes it: 81.9 / 81,9."""
    text = f"{value:.{decimals}f}" if decimals is not None else f"{value:g}"
    return text.replace(".", ",") if lang == SK else text


INSTRUCTION = {
    EN: "Answer language: English. Write answer, sources and followups in English.",
    UK: ("Answer language: the language of the question (Ukrainian if it is Ukrainian, otherwise that "
         "language). Write answer, sources and followups in it. Keep codes (ST-038), numbers and units "
         "as in the line data; quote station and error names in English."),
    SK: ("Answer language: Slovak (slovenčina). Write answer, sources and followups in Slovak with "
         "correct diacritics (á, ä, č, ď, é, í, ĺ, ľ, ň, ó, ô, ŕ, š, ť, ú, ý, ž); never drop them. "
         "Keep codes (ST-038), numbers and units as in the snapshot; a decimal comma is fine (81,9 %). "
         "Quote station and error names in English as the snapshot gives them; you may add a short "
         "Slovak gloss in brackets. Write pp as \"p. b.\" (percentuálneho bodu)."),
}
