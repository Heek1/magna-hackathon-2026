from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _jump(t):
    r = client.post("/api/sim/control", json={"paused": True, "jump_to": t})
    assert r.status_code == 200
    return r.json()


def test_unusable_speed_gets_422():
    for raw in ('{"speed": NaN}', '{"speed": Infinity}', '{"speed": 1e300}'):
        r = client.post("/api/sim/control", content=raw, headers={"Content-Type": "application/json"})
        assert r.status_code == 422, raw


def test_state_shape_and_active_downtime():
    _jump("2026-11-25T09:20:00")
    s = client.get("/api/state").json()
    assert set(s) == {"sim_time", "shift", "hours", "active_downtime"}
    assert {"date", "hour", "plan_min", "run_min", "downtime_min", "produced", "ok", "nok",
            "availability", "performance", "quality", "oee", "target"} <= set(s["shift"])
    assert s["shift"]["hour"] == 4
    assert s["active_downtime"]["code"] == "ST-038"
    assert len(s["hours"]) == 4


def test_endpoints_see_only_data_up_to_sim_time():
    _jump("2026-11-04T14:00:00")
    assert [h["date"] for h in client.get("/api/history").json()] == ["2026-11-02", "2026-11-03",
                                                                      "2026-11-04"]
    assert len(client.get("/api/heatmap?metric=oee").json()) == 24
    assert client.get("/api/heatmap?metric=foo").status_code == 422
    losses = client.get("/api/losses?from=2026-11-04&to=2026-11-04").json()
    assert {"type", "code", "device", "description", "loss_pcs", "loss_pp", "count", "fix"} == set(losses[0])


def test_insights_whatif_chat_stubs():
    assert isinstance(client.get("/api/insights").json(), list)
    w = client.post("/api/whatif", json={"remove": ["ST-038"], "from": "2026-11-02", "to": "2026-11-04"})
    assert set(w.json()) == {"oee_before", "oee_after", "gain_pcs", "gain_pp"}
    assert client.post("/api/chat", json={"question": "Why?"}).status_code == 503


def test_actions_crud():
    a = client.post("/api/actions", json={"title": "Clean camera", "insight_id": "x", "owner": "Maint"})
    assert a.status_code == 201
    a = a.json()
    assert a["status"] == "open"
    p = client.patch(f"/api/actions/{a['id']}", json={"status": "in_progress"}).json()
    assert p["status"] == "in_progress"
    assert client.patch(f"/api/actions/{a['id']}", json={"status": "bad"}).status_code == 422
    assert client.patch("/api/actions/99999", json={"status": "done"}).status_code == 404
    assert any(x["id"] == a["id"] for x in client.get("/api/actions").json())


def test_cors_for_frontend():
    r = client.get("/api/state", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_stream_sends_state_event_on_sim_change():
    import asyncio
    import json

    from app.main import sim, state_events

    async def never_disconnected():
        return False

    async def run():
        gen = state_events(never_disconnected)
        first = await gen.__anext__()
        sim.jump(datetime(2026, 11, 10, 8, 30))
        second = await gen.__anext__()
        await gen.aclose()
        return first, second

    _jump("2026-11-10T08:00:00")
    first, second = asyncio.run(run())
    assert first.startswith("event: state\ndata: ")
    assert json.loads(second.split("data: ", 1)[1])["sim_time"] == "2026-11-10T08:30:00"


def test_stream_route_is_sse():
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/stream")
    assert "GET" in route.methods
