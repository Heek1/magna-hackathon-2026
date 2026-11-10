from datetime import datetime

import pytest

from app import oee
from app.sim import Simulator, snapshot


def _st038(ds):
    row = ds.downtime[(ds.downtime["Kod_chyby"] == "ST-038")
                      & (ds.downtime["Cas_od"].dt.date == datetime(2026, 11, 25).date())]
    assert len(row) == 1
    return row.iloc[0]


def test_full_data_at_end_equals_month(ds):
    snap = snapshot(ds, datetime(2026, 11, 30, 14, 0))
    assert oee.kpis(snap.hours)["produced"] == 8251


def test_nothing_after_sim_time(ds):
    snap = snapshot(ds, datetime(2026, 11, 10, 9, 0))
    assert snap.hours["Cas_do"].max() <= datetime(2026, 11, 10, 9, 0)
    assert (snap.downtime["Cas_od"] < datetime(2026, 11, 10, 9, 0)).all()


def test_partial_hour_is_proportional(ds):
    # pick a full-plan hour without downtime
    h = ds.hours[(ds.hours["Plan_min"] == 60) & (ds.hours["Prestoj_min"] == 0)].iloc[10]
    t = h["Cas_od"] + (h["Cas_do"] - h["Cas_od"]) / 2
    last = snapshot(ds, t).hours.iloc[-1]
    assert last["Hodina_ID"] == h["Hodina_ID"]
    assert last["Plan_min"] == pytest.approx(30)
    assert last["Chod_min"] == pytest.approx(30)
    assert last["Vyrobene_ks"] == pytest.approx(h["Vyrobene_ks"] / 2)
    assert last["Mikrostop_s"] == pytest.approx(h["Mikrostop_s"] / 2)


def test_downtime_is_active_between_cas_od_and_cas_do(ds):
    r = _st038(ds)
    sim = Simulator(ds, paused=True)
    sim.jump(r["Cas_od"] - (r["Cas_do"] - r["Cas_od"]) / 10)
    assert sim.active_downtime() is None
    sim.jump(r["Cas_od"] + (r["Cas_do"] - r["Cas_od"]) / 2)
    active = sim.active_downtime()
    assert active["code"] == "ST-038"
    assert active["since"] == r["Cas_od"].isoformat()
    sim.jump(r["Cas_do"])
    assert sim.active_downtime() is None


def test_running_downtime_is_clipped(ds):
    r = _st038(ds)
    t = r["Cas_od"] + (r["Cas_do"] - r["Cas_od"]) / 2
    snap = snapshot(ds, t)
    row = snap.downtime[snap.downtime["Kod_chyby"] == "ST-038"].iloc[-1]
    assert row["Trvanie_min"] == pytest.approx(r["Trvanie_min"] / 2)
    assert snap.hours.iloc[-1]["Prestoj_min"] == pytest.approx(r["Trvanie_min"] / 2)


def test_advance_pause_speed_and_shift_rollover(ds):
    sim = Simulator(ds, speed=60, paused=True)
    start = sim.sim_time
    sim.advance(10)
    assert sim.sim_time == start  # paused
    sim.control(paused=False)
    sim.advance(10)
    assert (sim.sim_time - start).total_seconds() == 600
    sim.jump(datetime(2026, 11, 6, 13, 59))
    sim.advance(10)  # stops at end of shift
    assert sim.sim_time == datetime(2026, 11, 6, 14, 0)
    sim.advance(1)  # Friday → Monday morning
    assert sim.sim_time == datetime(2026, 11, 9, 6, 1)


def test_jump_outside_shift_is_clamped(ds):
    sim = Simulator(ds, paused=True)
    sim.jump(datetime(2026, 11, 7, 12, 0))  # Saturday
    assert sim.sim_time == datetime(2026, 11, 9, 6, 0)
    sim.jump(datetime(2027, 1, 1))
    assert sim.sim_time == datetime(2026, 11, 30, 14, 0)
