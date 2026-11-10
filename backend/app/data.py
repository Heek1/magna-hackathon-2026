"""Load data/oee.xlsx into pandas and validate the sheet structure."""
from __future__ import annotations

import warnings
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS: dict[str, list[str]] = {
    "Vyroba_hodiny": [
        "Hodina_ID", "Datum", "Hodina_zmeny", "Cas_od", "Cas_do", "Interval_min", "AM_min",
        "Pauza_min", "Plan_min", "Prestoj_min", "Chod_min", "Vyrobene_ks", "OK_ks", "NOK_ks",
        "Retesty_pocet", "Mikrostop_s", "Retest_cas_s", "Spomalenie_s",
    ],
    "Prestoje": [
        "Kod_chyby", "Hodina_ID", "Zariadenie", "Pricina", "Cas_od", "Cas_do", "Trvanie_min",
        "Popis_EN",
    ],
    "NOK_detail": ["Hodina_ID", "Pricina", "NOK_ks", "Kod_chyby", "Kategoria_chyby", "Popis_EN"],
    "Ciselnik_chyb": ["Kod_chyby", "Typ", "Popis_EN"],
    "Kontrola_zmien": [
        "Datum", "Plan_min", "Prestoj_min", "Chod_min", "Vyrobene_ks", "OK_ks", "NOK_ks",
        "Mikrostop_s", "Retest_cas_s", "Spomalenie_s", "OEE",
    ],
}

TOTAL_ROW_LABEL = "MESIAC"


class DataError(ValueError):
    """The workbook does not have the expected structure."""


@dataclass
class Dataset:
    hours: pd.DataFrame       # Vyroba_hodiny
    downtime: pd.DataFrame    # Prestoje
    nok: pd.DataFrame         # NOK_detail
    codes: pd.DataFrame       # Ciselnik_chyb
    control: pd.DataFrame     # Kontrola_zmien without the MESIAC row
    month_total: pd.Series | None  # the MESIAC row, if present


def load(source: str | Path | bytes) -> Dataset:
    """Read the workbook (path or raw bytes), validate it and return typed DataFrames."""
    if isinstance(source, bytes):
        import io
        source = io.BytesIO(source)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # openpyxl warns about unsupported Excel extensions
        try:
            sheets = pd.read_excel(source, sheet_name=list(REQUIRED_COLUMNS))
        except ValueError as exc:  # a required sheet is missing
            raise DataError(str(exc)) from exc

    problems = []
    for name, cols in REQUIRED_COLUMNS.items():
        missing = [c for c in cols if c not in sheets[name].columns]
        if missing:
            problems.append(f"{name}: missing columns {missing}")
    if problems:
        raise DataError("; ".join(problems))

    hours = sheets["Vyroba_hodiny"].copy()
    for col in ("Datum", "Cas_od", "Cas_do"):
        hours[col] = pd.to_datetime(hours[col])
    hours = hours.sort_values("Cas_od").reset_index(drop=True)

    downtime = sheets["Prestoje"].copy()
    for col in ("Cas_od", "Cas_do"):
        downtime[col] = pd.to_datetime(downtime[col])
    downtime = downtime.sort_values("Cas_od").reset_index(drop=True)

    nok = sheets["NOK_detail"].copy()

    control = sheets["Kontrola_zmien"].copy()
    is_total = control["Datum"].astype(str).str.strip().str.upper() == TOTAL_ROW_LABEL
    month_total = control[is_total].iloc[0] if is_total.any() else None
    control = control[~is_total].copy()
    control["Datum"] = pd.to_datetime(control["Datum"])

    if hours.empty:
        raise DataError("Vyroba_hodiny has no rows")
    unknown = set(downtime["Hodina_ID"]) - set(hours["Hodina_ID"])
    if unknown:
        raise DataError(f"Prestoje refers to unknown Hodina_ID: {sorted(unknown)[:5]}")

    return Dataset(hours, downtime, nok, sheets["Ciselnik_chyb"].copy(), control.reset_index(drop=True),
                   month_total)
