import pytest

from app import data, oee


def test_mesiac_row_is_dropped(ds):
    assert "MESIAC" not in ds.control["Datum"].astype(str).tolist()
    assert ds.month_total is not None
    assert len(ds.control) == ds.hours["Datum"].nunique()


def test_missing_sheet_or_column_is_reported(tmp_path, ds):
    import pandas as pd
    path = tmp_path / "bad.xlsx"
    with pd.ExcelWriter(path) as w:
        ds.hours.drop(columns=["Chod_min"]).to_excel(w, sheet_name="Vyroba_hodiny", index=False)
    with pytest.raises(data.DataError):
        data.load(path)


@pytest.mark.parametrize("col", ["Plan_min", "Prestoj_min", "Chod_min", "Vyrobene_ks", "OK_ks",
                                 "NOK_ks", "Mikrostop_s", "Retest_cas_s", "Spomalenie_s"])
def test_every_shift_sums_match_control(ds, col):
    by_day = ds.hours.groupby(ds.hours["Datum"].dt.normalize())[col].sum()
    control = ds.control.set_index("Datum")[col]
    assert (by_day == control).all()


def test_every_shift_oee_matches_control(ds):
    hist = {h["date"]: h["oee"] for h in oee.history(ds.hours)}
    for _, row in ds.control.iterrows():
        assert hist[row["Datum"].date().isoformat()] == pytest.approx(row["OEE"], abs=1e-4)


def test_month_totals_match_control_numbers(ds):
    k = oee.kpis(ds.hours)
    assert (k["produced"], k["ok"], k["nok"], k["downtime_min"]) == (8251, 8132, 119, 410)
    assert round(k["oee"] * 100, 2) == 88.01


def test_downtime_table_matches_hours(ds):
    per_hour = ds.downtime.groupby("Hodina_ID")["Trvanie_min"].sum()
    hours = ds.hours.set_index("Hodina_ID")["Prestoj_min"]
    assert (hours[hours > 0] == per_hour.reindex(hours[hours > 0].index)).all()
    assert ds.nok["NOK_ks"].sum() == ds.hours["NOK_ks"].sum()


def test_losses_add_up_to_ideal_minus_good(ds):
    items = oee.losses(ds.hours, ds.downtime, ds.nok)
    by_type = {}
    for i in items:
        by_type[i["type"]] = by_type.get(i["type"], 0) + i["loss_pcs"]
    assert by_type["downtime"] == pytest.approx(410)
    assert by_type["microstop"] + by_type["retest"] + by_type["slowdown"] == pytest.approx(8830 - 8251)
    assert by_type["nok"] == pytest.approx(119)
    assert sum(by_type.values()) == pytest.approx(9240 - 8132)  # 1108 pcs lost
    assert items == sorted(items, key=lambda x: x["loss_pcs"], reverse=True)


def test_history_range_filter(ds):
    rows = oee.history(ds.hours, "2026-11-09", "2026-11-13")
    assert [r["date"] for r in rows] == ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12",
                                          "2026-11-13"]


def test_heatmap_has_one_cell_per_hour(ds):
    cells = oee.heatmap(ds.hours, "downtime")
    assert len(cells) == 168
    assert sum(c["value"] for c in cells) == pytest.approx(410)
