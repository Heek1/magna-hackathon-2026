"""Run from backend/:  python -m pytest -q   (or only this folder: python -m pytest insights -q)

The input frames come from the real loader and simulator (app.data, app.sim), exactly as
app/insights_bridge.py passes them to get_insights.
"""
import json
import os
import tempfile
from pathlib import Path

import pandas as pd
import pytest

os.environ.setdefault("ACTIONS_DB", os.path.join(tempfile.mkdtemp(), "test_actions.db"))

from app import data as loader  # noqa: E402
from app.sim import snapshot  # noqa: E402

from . import engine  # noqa: E402
from .engine import get_insights  # noqa: E402

XLSX = Path(__file__).resolve().parents[2] / "data" / "oee.xlsx"
FIELDS = {"id", "kind", "severity", "title", "evidence", "code", "loss_pcs", "loss_pp",
          "expected_at", "recommendation"}


@pytest.fixture(scope="module")
def ds():
    return loader.load(XLSX)


@pytest.fixture(autouse=True)
def no_countermeasures(monkeypatch, tmp_path):
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", tmp_path / "missing.json")


def at(ds, sim_time, with_sim_time=True):
    """Frames as the API hands them over at sim_time."""
    frames = snapshot(ds, pd.Timestamp(sim_time)).as_frames()
    if not with_sim_time:
        for df in frames.values():
            df.attrs.pop("sim_time")
    return frames


def whole(ds):
    return {"hours": ds.hours, "downtime": ds.downtime, "nok": ds.nok}


def of_kind(insights, kind):
    return [i for i in insights if i["kind"] == kind]


def test_full_data_finds_the_known_patterns(ds):
    insights = get_insights(whole(ds))

    stops = {i["code"]: i for i in of_kind(insights, "recurring_stop")}
    assert set(stops) == {"ST-038", "ST-047"}
    assert stops["ST-038"]["loss_pcs"] == 100
    assert stops["ST-047"]["loss_pcs"] == 60
    assert "Nov 4, 11, 18, 25" in stops["ST-038"]["evidence"]
    assert "at 09:08 on Kamera, 25 min each" in stops["ST-038"]["evidence"]
    assert "at 08:08 on Leak test, 15 min each" in stops["ST-047"]["evidence"]
    assert stops["ST-038"]["loss_pp"] == pytest.approx(100 / 9240 * 100, abs=0.01)

    slow = {i["code"]: i for i in of_kind(insights, "slow_hour")}
    assert set(slow) == {"slow_hour_1", "slow_hour_5"}
    assert "88.5%" in slow["slow_hour_1"]["title"]
    assert "86.9%" in slow["slow_hour_5"]["title"]

    pareto = [i for i in of_kind(insights, "quality") if i["id"].startswith("quality:pareto")]
    assert pareto[0]["code"] == "Q-031" and pareto[0]["loss_pcs"] == 38

    assert of_kind(insights, "prediction") == []  # Nov 30 is a Monday


def test_contract_shape_and_sorting(ds):
    for frames in (whole(ds), at(ds, "2026-11-25 08:30"), at(ds, "2026-11-25 09:20")):
        insights = get_insights(frames)
        assert insights
        for item in insights:
            assert set(item) == FIELDS
            assert item["kind"] in {"recurring_stop", "prediction", "slow_hour", "quality", "anomaly"}
            assert item["severity"] in {"high", "medium", "low"}
            assert item["recommendation"] is None
        losses = [i["loss_pcs"] for i in insights]
        assert losses == sorted(losses, reverse=True)
        assert len({i["id"] for i in insights}) == len(insights)
        json.dumps(insights)  # plain JSON types only


def test_no_false_recurring_stops_at_any_shift_end(ds):
    for date in sorted(set(ds.hours["Datum"])):
        end = date + pd.Timedelta(hours=14)
        codes = {i["code"] for i in of_kind(get_insights(at(ds, end)), "recurring_stop")}
        assert codes <= {"ST-038", "ST-047"}, f"{end}: {codes}"


@pytest.mark.parametrize("with_sim_time", [True, False])
def test_prediction_appears_before_the_stop_and_disappears_after(ds, with_sim_time):
    before = of_kind(get_insights(at(ds, "2026-11-25 08:30", with_sim_time)), "prediction")
    assert [i["code"] for i in before] == ["ST-038"]
    assert before[0]["expected_at"] == "2026-11-25T09:08:00"
    assert before[0]["loss_pcs"] == 25
    assert before[0]["severity"] == "high"

    for later in ("2026-11-25 09:10", "2026-11-25 10:30"):
        assert of_kind(get_insights(at(ds, later, with_sim_time)), "prediction") == []


def test_prediction_on_thursday_and_third_week(ds):
    thursday = of_kind(get_insights(at(ds, "2026-11-26 07:30")), "prediction")
    assert [(i["code"], i["expected_at"]) for i in thursday] == [("ST-047", "2026-11-26T08:08:00")]
    # two earlier Wednesdays are enough to warn on the third one, right from the shift start
    third = of_kind(get_insights(at(ds, "2026-11-18 06:00")), "prediction")
    assert [i["code"] for i in third] == ["ST-038"]
    assert of_kind(get_insights(at(ds, "2026-11-24 08:30")), "prediction") == []


def test_stop_in_progress_counts_only_the_elapsed_minutes(ds):
    insights = get_insights(at(ds, "2026-11-25 09:20"))  # ST-038 is active since 09:08
    stop = next(i for i in insights if i["id"] == "recurring_stop:ST-038:wed:4")
    assert stop["loss_pcs"] == 75 + 12
    assert "4 of 4 Wednesdays (Nov 4, 11, 18, 25)" in stop["evidence"]
    assert "typically 25 min" in stop["evidence"]
    assert of_kind(insights, "prediction") == []


def test_microstop_anomaly_before_the_camera_stop(ds):
    insights = of_kind(get_insights(at(ds, "2026-11-25 08:59")), "anomaly")
    item = next(i for i in insights if i["id"] == "anomaly:microstop:2026-11-25:3")
    assert item["code"] == "microstop"


def test_oee_anomaly_in_an_hour_with_an_unusual_stop(ds):
    # 13 min of ST-046 in hour 2, which normally runs without downtime
    insights = of_kind(get_insights(at(ds, "2026-11-25 08:00")), "anomaly")
    item = next(i for i in insights if i["id"] == "anomaly:oee:2026-11-25:2")
    assert item["code"] == "ST-046"  # the stop that caused it, so it gets that code's countermeasure
    assert "13 min, mainly ST-046" in item["evidence"]


def test_no_anomaly_while_the_hour_has_barely_run(ds):
    assert of_kind(get_insights(at(ds, "2026-11-25 08:05")), "anomaly") == []


def test_scrap_spike_against_the_previous_days(ds):
    # Q-030: 3 pcs on Nov 12 vs 0.8 per shift before
    spikes = [i for i in get_insights(at(ds, "2026-11-12 14:00")) if i["id"].startswith("quality:spike")]
    assert [i["id"] for i in spikes] == ["quality:spike:Q-030:2026-11-12"]
    assert not any(i["id"].startswith("quality:spike") for i in get_insights(at(ds, "2026-11-13 14:00")))


def test_recommendation_from_countermeasures(ds, monkeypatch, tmp_path):
    path = tmp_path / "countermeasures.json"
    path.write_text(json.dumps({
        "ST-038": {"action": "Clean the camera light", "method": "Autonomous maintenance",
                   "owner_role": "Maintenance"},
        "slow_hour": {"action": "Prepare the line", "method": "Standard work",
                      "owner_role": "Team leader"},
    }), encoding="utf-8")
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", path)

    by_id = {i["id"]: i for i in get_insights(whole(ds))}
    assert by_id["recurring_stop:ST-038:wed:4"]["recommendation"] == {
        "action": "Clean the camera light", "method": "Autonomous maintenance",
        "owner_role": "Maintenance", "expected_gain_pcs": 100.0}
    assert by_id["slow_hour:1"]["recommendation"]["owner_role"] == "Team leader"  # by kind
    assert by_id["recurring_stop:ST-047:thu:3"]["recommendation"] is None


def test_start_of_the_first_shift(ds):
    assert get_insights(at(ds, "2026-11-02 06:00")) == []  # no rows yet
    insights = get_insights(at(ds, "2026-11-02 06:20"))
    assert of_kind(insights, "recurring_stop") == []
    assert of_kind(insights, "slow_hour") == []


def test_api_serves_the_real_insights():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T08:30:00"})
    insights = client.get("/api/insights").json()
    assert [(i["code"], i["expected_at"]) for i in insights if i["kind"] == "prediction"] == [
        ("ST-038", "2026-11-25T09:08:00")]
    assert {i["code"] for i in insights if i["kind"] == "recurring_stop"} == {"ST-038", "ST-047"}


# ---------- stage 2: what_if ----------

from .whatif import what_if  # noqa: E402


def test_what_if_without_the_recurring_stops(ds):
    result = what_if(whole(ds), ["ST-038", "ST-047"])
    assert result["oee_before"] == 0.8801  # monthly control number
    # 160 min become run time at the month's Performance and Quality
    gain = 160 * (8251 / 8830) * (8132 / 8251)
    assert result["gain_pcs"] == round(gain, 1)
    assert result["gain_pp"] == pytest.approx(gain / 9240 * 100, abs=0.01)
    assert result["oee_after"] == pytest.approx(0.8801 + gain / 9240, abs=0.0002)


def test_what_if_slow_hours_and_other_keys(ds):
    frames = whole(ds)
    slow = what_if(frames, ["slow_hour_1", "slow_hour_5"])
    assert slow["gain_pp"] == pytest.approx(1.14, abs=0.03)
    assert what_if(frames, ["slow_hour_3"])["gain_pcs"] == 0  # not below the others
    assert what_if(frames, ["Q-031"])["gain_pcs"] == 38
    assert what_if(frames, ["microstop"])["gain_pcs"] == pytest.approx(11999 / 60 * 8132 / 8251, abs=0.1)
    assert what_if(frames, ["NOPE"]) == {"oee_before": 0.8801, "oee_after": 0.8801,
                                         "gain_pcs": 0.0, "gain_pp": 0.0}
    both = what_if(frames, ["ST-038", "ST-038", "slow_hour_1"])  # duplicates count once
    assert both["gain_pcs"] == pytest.approx(
        what_if(frames, ["ST-038"])["gain_pcs"] + what_if(frames, ["slow_hour_1"])["gain_pcs"], abs=0.1)


def test_what_if_period(ds):
    from datetime import date
    day = what_if(whole(ds), ["ST-038"], date(2026, 11, 4), date(2026, 11, 4))
    assert day["oee_before"] == 0.8159  # Kontrola_zmien 2026-11-04
    assert day["gain_pcs"] == pytest.approx(25 * (366 / 405) * (359 / 366), abs=0.1)
    assert what_if(whole(ds), ["ST-038"], date(2026, 11, 5), date(2026, 11, 6))["gain_pcs"] == 0
    assert what_if(whole(ds), ["ST-038"], date(2027, 1, 1), None)["oee_after"] == 0


# ---------- stage 2: chat ----------

from .chat import ChatUnavailable, chat  # noqa: E402


def test_chat_without_key_is_unavailable(ds, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ChatUnavailable):
        chat("Why?", whole(ds))


def test_chat_sends_the_snapshot_and_returns_the_answer(ds, monkeypatch):
    import io
    sent = {}

    def fake_urlopen(request, timeout):
        sent["url"], sent["headers"] = request.full_url, dict(request.header_items())
        sent["body"] = json.loads(request.data)
        return io.BytesIO(json.dumps(
            {"candidates": [{"content": {"parts": [{"text": " Camera, ST-038. "}]}}]}).encode())

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    answer = chat("Why are Wednesdays below target?", at(ds, "2026-11-25 08:30"))

    assert answer == "Camera, ST-038."
    assert "test-key" not in sent["url"] and sent["headers"]["X-goog-api-key"] == "test-key"
    text = sent["body"]["contents"][0]["parts"][0]["text"]
    assert "Why are Wednesdays below target?" in text
    assert "ST-038" in text and "2026-11-25T09:08:00" in text  # the prediction is in the snapshot
    assert "only from the JSON snapshot" in sent["body"]["system_instruction"]["parts"][0]["text"]


def test_api_serves_what_if_and_chat_503(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-30T14:00:00"})
    result = client.post("/api/whatif", json={"remove": ["ST-038", "ST-047"]}).json()
    assert result["oee_before"] == 0.8801 and result["gain_pp"] == pytest.approx(1.59, abs=0.01)
    assert client.post("/api/chat", json={"question": "Why?"}).status_code == 503


# ---------- the real countermeasures.json ----------

def test_real_countermeasures_cover_the_insights(ds, monkeypatch):
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", Path(engine.__file__).with_name("countermeasures.json"))
    for frames in (whole(ds), at(ds, "2026-11-25 08:30"), at(ds, "2026-11-25 08:00")):
        for item in get_insights(frames):
            if item["code"] is None:  # an OEE anomaly without a stop has no single cause
                continue
            rec = item["recommendation"]
            assert rec and rec["action"] and rec["method"] and rec["owner_role"], item["id"]
            assert rec["expected_gain_pcs"] == item["loss_pcs"]


# ---------- what the frontend sends (What if panel, chat probe) ----------

def test_what_if_speed_gain_is_capped_by_the_speed_loss(ds):
    frames = whole(ds)
    speed = ["microstop", "retest", "slowdown"]
    all_speed = what_if(frames, speed)
    assert all_speed["gain_pcs"] == pytest.approx((8830 - 8251) * 8132 / 8251, abs=0.2)
    # slow hours are already inside the speed losses
    assert what_if(frames, speed + ["slow_hour_1", "slow_hour_5"]) == all_speed
    everything = what_if(frames, speed + ["slow_hour_1", "ST-038", "ST-047", "ST-001", "ST-016",
                                          "ST-017", "ST-046", "Q-020", "Q-026", "Q-030", "Q-031"])
    assert everything["oee_after"] <= 1


def test_chat_probe_with_an_empty_question_does_not_call_the_llm(ds, monkeypatch):
    def no_call(*args, **kwargs):
        raise AssertionError("LLM called")

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("urllib.request.urlopen", no_call)
    assert chat("", whole(ds)) == ""
    assert chat("   ", whole(ds)) == ""


def test_chat_answers_in_words_when_the_llm_fails(ds, monkeypatch):
    import urllib.error

    def rate_limited(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 429, "Too Many Requests", {}, None)

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("urllib.request.urlopen", rate_limited)
    assert "HTTP 429" in chat("Why?", whole(ds))
    monkeypatch.setattr("urllib.request.urlopen", lambda request, timeout: (_ for _ in ()).throw(TimeoutError()))
    assert "did not respond" in chat("Why?", whole(ds))
