from datetime import date, datetime

from fastapi.testclient import TestClient

from app import errors
from app.main import app
from app.sim import snapshot

END = datetime(2026, 11, 30, 14, 0)


def test_fixes_cover_losses(ds):
    fixes = errors.load_fixes()
    snap = snapshot(ds, END)
    from app import oee
    items = errors.with_fix(oee.losses(snap.hours, snap.downtime, snap.nok), fixes)
    st038 = next(i for i in items if i["code"] == "ST-038")
    assert st038["fix"]["owner_role"] == "Maintenance"
    assert all("fix" in i for i in items)


def test_events_of_a_day(ds):
    t = datetime(2026, 11, 25, 9, 20)
    snap = snapshot(ds, t)
    ev = errors.events(snap.hours, snap.downtime, snap.nok, date(2026, 11, 25), t)
    assert ev[0]["code"] == "ST-038" and ev[0]["active"] and ev[0]["value"] == 12.0
    assert [e["time"] for e in ev] == sorted((e["time"] for e in ev), reverse=True)
    assert {e["kind"] for e in ev} <= {"stop", "defect", "speed"}
    assert all(e["time"] <= t.isoformat() for e in ev)


def test_detail_stop_pattern_and_next(ds):
    snap = snapshot(ds, END)
    d = errors.detail("ST-038", snap.hours, snap.downtime, snap.nok, {}, END)
    assert d["kind"] == "stop" and d["count"] == 4 and d["minutes"] == 100
    assert d["pattern"] == [{"weekday": "Wed", "hour": 9, "count": 4}]
    assert d["next_expected"] == "2026-12-02T09:08:00"


def test_detail_defect_and_speed_sum_to_losses(ds):
    from app import oee
    snap = snapshot(ds, END)
    by_code = {i["code"]: i["loss_pcs"] for i in oee.losses(snap.hours, snap.downtime, snap.nok)}
    q = errors.detail("Q-031", snap.hours, snap.downtime, snap.nok, {}, END)
    assert q["kind"] == "defect" and q["loss_pcs"] == by_code["Q-031"]
    m = errors.detail("microstop", snap.hours, snap.downtime, snap.nok, {}, END)
    assert m["kind"] == "speed" and abs(m["loss_pcs"] - by_code["microstop"]) < 1
    assert errors.detail("NOPE", snap.hours, snap.downtime, snap.nok, {}, END) is None


def test_api_routes():
    c = TestClient(app)
    c.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    assert c.get("/api/events").json()[0]["code"] == "ST-038"
    assert c.get("/api/events", params={"date": "2026-11-02"}).status_code == 200
    r = c.get("/api/errors/ST-038")
    assert r.status_code == 200 and 0 < r.json()["gain_pp"] <= r.json()["loss_pp"]
    assert c.get("/api/errors/NOPE").status_code == 404
    assert "fix" in c.get("/api/losses").json()[0]
