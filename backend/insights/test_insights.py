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

from .chat import ChatUnavailable, build_snapshot, chat, suggestions  # noqa: E402


def test_chat_without_key_is_unavailable(ds, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ChatUnavailable):
        chat("Why?", whole(ds))


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


# ---------- mobile app, stage 1: upcoming ----------

from .upcoming import upcoming  # noqa: E402

UPCOMING_FIELDS = {"code", "kind", "title", "expected_at", "confidence", "risk_pcs", "evidence",
                   "insight_id"}


def test_upcoming_during_the_camera_stop(ds):
    frames = at(ds, "2026-11-25 09:20")
    items = upcoming(frames)
    assert items[0] == {
        "code": "ST-047", "kind": "stop", "title": "Test nest allows air leakage",
        "expected_at": "2026-11-26T08:08:00", "confidence": "high", "risk_pcs": 15.0,
        "evidence": "3 of 3 Thursdays at 08:08", "insight_id": "recurring_stop:ST-047:thu:3"}
    for item in items:
        assert set(item) == UPCOMING_FIELDS and item["kind"] == "stop"
        assert item["confidence"] in {"high", "medium", "low"}
        assert item["expected_at"] > "2026-11-25T09:20:00"
    assert [i["expected_at"] for i in items] == sorted(i["expected_at"] for i in items)
    # ST-038 is running now: not expected again today, but next Wednesday, at its full 25 min
    camera = [i for i in items if i["code"] == "ST-038"]
    assert [(i["expected_at"], i["risk_pcs"], i["confidence"]) for i in camera] == [
        ("2026-12-02T09:08:00", 25.0, "high")]
    insight_ids = {i["id"] for i in get_insights(frames)}
    for item in items:
        assert (item["insight_id"] in insight_ids) if item["confidence"] != "low" else item["insight_id"] is None
    json.dumps(items)


def test_upcoming_horizon_counts_shift_time_only(ds):
    frames = at(ds, "2026-11-25 09:20")
    # 4 h 40 min of today's shift remain, so Thursday 08:08 is 6.8 shift hours away
    assert upcoming(frames, 6) == []
    assert [i["code"] for i in upcoming(frames, 8)] == ["ST-047"]
    # Friday 13:00 -> Monday is one shift hour plus the weekend, which does not count
    friday = upcoming(at(ds, "2026-11-20 13:00"), 8)
    assert all(i["expected_at"].startswith("2026-11-23") for i in friday)


def test_upcoming_before_the_stop_and_on_the_whole_dataset(ds):
    before = upcoming(at(ds, "2026-11-25 08:30"))
    assert (before[0]["code"], before[0]["expected_at"]) == ("ST-038", "2026-11-25T09:08:00")
    after_data = upcoming(whole(ds))  # no sim_time: "now" is the end of Nov 30
    assert [(i["code"], i["expected_at"]) for i in after_data if i["confidence"] == "high"] == [
        ("ST-038", "2026-12-02T09:08:00"), ("ST-047", "2026-12-03T08:08:00")]
    assert upcoming(at(ds, "2026-11-02 06:00")) == []
    assert upcoming(at(ds, "2026-11-04 12:00")) == []  # one occurrence is not a pattern


def test_upcoming_is_fast(ds):
    import time
    frames = at(ds, "2026-11-30 14:00")
    start = time.perf_counter()
    upcoming(frames)
    assert time.perf_counter() - start < 0.2


# ---------- mobile app, stage 2: explain ----------

from .explain import explain  # noqa: E402

ALL_CODES = ["ST-001", "ST-016", "ST-017", "ST-038", "ST-046", "ST-047", "Q-020", "Q-026", "Q-030",
             "Q-031", "microstop", "retest", "slowdown"]


def test_explain_recurring_stops(ds):
    frames = at(ds, "2026-11-25 09:20")
    assert explain(frames, "ST-038") == (
        "Stops every Wednesday at 09:08 (4 of 4 weeks), about 25 min each, at the camera station "
        "— a scheduled pattern, not random wear.")  # the running stop does not distort "25 min"
    assert explain(frames, "ST-047") == (
        "Stops every Thursday at 08:08 (3 of 3 weeks), about 15 min each, at the leak test station "
        "— a scheduled pattern, not random wear.")


def test_explain_other_stops_defects_and_speed(ds):
    frames = at(ds, "2026-11-25 09:20")
    assert explain(frames, "ST-046") == (
        "5 stops on 5 days, about 11 min each, at the leak test station. "
        "No fixed schedule; most often in shift hour 3 (2 of 5).")
    assert explain(frames, "Q-031") == (
        "32 NOK pcs, 33% of all scrap, on 15 of 18 days — a steady defect, not a one-off. "
        "Most in shift hour 5 (8 of 32 pcs), a consistently slow hour.")
    assert explain(frames, "microstop") == (
        "Microstops cost 162.5 pcs, 1.3 s per run minute. "
        "Worst in the slow shift hours 1 and 5: 2.1 and 2.8 s/min vs 1.1 elsewhere.")
    assert explain(frames, "slowdown").startswith("Slowdown costs 272.1 pcs")
    assert explain(frames, "retest").startswith("Retests cost 45.3 pcs")


def test_explain_links_to_today(ds):
    # 13 min of ST-046 made hour 2 of Nov 25 an OEE anomaly
    assert explain(at(ds, "2026-11-25 08:00"), "ST-046").endswith(
        "No fixed schedule; it is behind the abnormally low OEE of the current hour (2).")
    assert explain(at(ds, "2026-11-12 14:00"), "Q-030").endswith(
        "Today it spiked: 3 pcs, 2.2 above a normal shift.")


def test_explain_nothing_to_say(ds):
    frames = at(ds, "2026-11-25 09:20")
    assert explain(frames, "ST-002") is None       # in the code list, never happened
    assert explain(frames, "NOPE") is None
    assert explain(at(ds, "2026-11-04 12:00"), "ST-038") is None   # one occurrence so far
    assert explain(at(ds, "2026-11-02 06:00"), "ST-038") is None   # no data yet
    assert explain(at(ds, "2026-11-02 06:20"), "microstop") is None


def test_explain_is_short_and_fast_at_any_moment(ds):
    import time
    for date in sorted(set(ds.hours["Datum"])):
        for minutes in (125, 200, 480):
            frames = at(ds, date + pd.Timedelta(hours=6, minutes=minutes))
            for code in ALL_CODES:
                text = explain(frames, code)
                if text is not None:
                    assert len(text) <= 220, text
                    assert text.endswith(".") and text.count(". ") <= 1, text
    frames = at(ds, "2026-11-30 14:00")
    start = time.perf_counter()
    explain(frames, "ST-038")
    assert time.perf_counter() - start < 0.2


# ---------- mobile app, stage 3: the pitch numbers on the full month ----------

def test_pitch_numbers(ds):
    frames = at(ds, "2026-11-30 14:00")
    hours = frames["hours"]
    plan, run = hours["Plan_min"].sum(), hours["Chod_min"].sum()
    produced, ok = hours["Vyrobene_ks"].sum(), hours["OK_ks"].sum()

    # the pitch says ~ +1.7 pp: that is 160 lost minutes / 9240; in good pieces it is +1.59 pp
    stops = what_if(frames, ["ST-038", "ST-047"])
    assert stops == {"oee_before": 0.8801, "oee_after": 0.896, "gain_pcs": 147.4, "gain_pp": 1.59}
    assert 160 / plan * 100 == pytest.approx(1.73, abs=0.005)

    # the pitch says ~ +1.1 pp
    slow = what_if(frames, ["slow_hour_1", "slow_hour_5"])
    assert slow == {"oee_before": 0.8801, "oee_after": 0.8915, "gain_pcs": 105.5, "gain_pp": 1.14}

    # the pitch says 1108 pcs lost: 52 % speed, 37 % downtime, 11 % scrap
    lost = plan - ok
    speed, downtime, scrap = run - produced, hours["Prestoj_min"].sum(), hours["NOK_ks"].sum()
    assert (lost, speed, downtime, scrap) == (1108, 579, 410, 119)
    assert [round(100 * part / lost, 1) for part in (speed, downtime, scrap)] == [52.3, 37.0, 10.7]


# ---------- Ask AI: chat with history, focus code, role (fake LLM, no network) ----------

class FakeLLM:
    """Stands in for urllib.request.urlopen; records the request, replies with `text`."""

    def __init__(self, text):
        self.text, self.calls = text, []

    def __call__(self, request, timeout):
        import io
        self.calls.append({"url": request.full_url, "headers": dict(request.header_items()),
                           "body": json.loads(request.data), "timeout": timeout})
        if isinstance(self.text, Exception):
            raise self.text
        return io.BytesIO(json.dumps({"candidates": [{"content": {"parts": [{"text": self.text}]}}]}).encode())

    @property
    def prompt(self):
        return self.calls[-1]["body"]["contents"][-1]["parts"][0]["text"]

    @property
    def snapshot(self):
        return json.loads(self.prompt.split("Snapshot:\n", 1)[1].split("\n\nQuestion: ", 1)[0])


REPLY = json.dumps({"answer": "ST-038 stops the camera every Wednesday at 09:08.",
                    "sources": ["ST-038 · 4 stops", "OEE by weekday", "", 7, "a", "b", "c"],
                    "followups": ["And on Thursdays?", "Who fixes it?", "How much do we gain?", "4th"]})


@pytest.fixture
def llm(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", Path(engine.__file__).with_name("countermeasures.json"))
    fake = FakeLLM(REPLY)
    monkeypatch.setattr("urllib.request.urlopen", fake)
    return fake


def test_chat_returns_answer_sources_followups(ds, llm):
    result = chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"))
    assert result == {"answer": "ST-038 stops the camera every Wednesday at 09:08.",
                      "sources": ["ST-038 · 4 stops", "OEE by weekday", "a", "b"],
                      "followups": ["And on Thursdays?", "Who fixes it?", "How much do we gain?"]}
    call = llm.calls[0]
    assert "test-key" not in call["url"] and call["headers"]["X-goog-api-key"] == "test-key"
    assert call["timeout"] == 10
    assert call["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert "only from the JSON" in call["body"]["system_instruction"]["parts"][0]["text"]
    assert llm.prompt.endswith("Question: Why is OEE low on Wednesdays?")


def test_chat_snapshot_has_weekdays_upcoming_gains_and_open_actions(ds, llm):
    actions = [{"title": "Clean the camera light", "owner": "Maintenance", "status": "open"},
               {"title": "Old one", "owner": "Quality", "status": "done"}]
    chat("What should I prepare for tomorrow?", at(ds, "2026-11-25 09:20"), actions=actions)
    snap = llm.snapshot
    wednesday = next(d for d in snap["oee_by_weekday"] if d["weekday"] == "Wednesday")
    assert wednesday["oee_pct"] == min(d["oee_pct"] for d in snap["oee_by_weekday"]) == 81.9
    assert snap["upcoming_stops"][0]["code"] == "ST-047"
    assert snap["upcoming_stops"][0]["expected_at"] == "2026-11-26T08:08:00"
    assert snap["upcoming_stops"][0]["fix"]["owner_role"] == "Maintenance"
    assert snap["open_actions"] == [{"title": "Clean the camera light", "owner": "Maintenance", "status": "open"}]
    assert "focus_error" not in snap and snap["user_role"] is None


def test_chat_snapshot_gains_match_what_if(ds, llm):
    chat("How much do we gain?", at(ds, "2026-11-30 14:00"))
    gains = {tuple(g["remove"]): g["gain_pp"] for g in llm.snapshot["what_if"]}
    assert gains[("ST-038",)] == 1.0 and gains[("ST-047",)] == 0.6
    assert gains[("ST-038", "ST-047")] == 1.59
    assert gains[("slow_hour_1", "slow_hour_5")] == 1.14


def test_chat_snapshot_with_focus_code(ds, llm):
    chat("How much do we gain if we fix this?", at(ds, "2026-11-30 14:00"), code="ST-038")
    focus = llm.snapshot["focus_error"]
    assert focus["code"] == "ST-038" and focus["type"] == "stop" and focus["station"] == "Camera"
    assert (focus["count"], focus["minutes"], focus["loss_pcs"]) == (4, 100.0, 100.0)
    assert focus["when"] == [{"weekday": "Wednesday", "time": "09:08", "count": 4}]
    assert focus["why"].startswith("Stops every Wednesday at 09:08 (4 of 4 weeks)")
    assert focus["fix"]["owner_role"] == "Maintenance"
    assert focus["gain_if_fixed"]["gain_pp"] == 1.0
    assert focus["next_expected"]["expected_at"] == "2026-12-02T09:08:00"
    # defect and speed codes work too; an unknown code is said to have no occurrences
    for code, kind in (("Q-031", "defect"), ("microstop", "speed")):
        chat("Why?", at(ds, "2026-11-30 14:00"), code=code)
        assert llm.snapshot["focus_error"]["type"] == kind
    chat("Why?", at(ds, "2026-11-30 14:00"), code="ST-999")
    assert llm.snapshot["focus_error"] == {"code": "ST-999", "note": "no occurrences"}


def test_chat_snapshot_with_role_puts_their_fixes_first(ds, llm):
    chat("What should I do?", at(ds, "2026-11-25 09:20"), role="Team leader")
    snap = llm.snapshot
    assert snap["user_role"] == "Team leader"
    owners = [i["fix"] and i["fix"]["owner_role"] for i in snap["insights"]]
    first_other = next(n for n, o in enumerate(owners) if o != "Team leader")
    assert owners[:first_other] and all(o == "Team leader" for o in owners[:first_other])
    assert "Team leader" not in owners[first_other:]


def test_chat_sends_the_last_six_turns(ds, llm):
    history = [{"role": "user" if n % 2 == 0 else "assistant", "text": f"turn {n}"} for n in range(9)]
    history.append({"role": "user", "text": "   "})
    chat("and on Thursdays?", at(ds, "2026-11-25 09:20"), history=history)
    contents = llm.calls[0]["body"]["contents"]
    assert [(c["role"], c["parts"][0]["text"]) for c in contents[:-1]] == [
        ("user", "turn 4"), ("model", "turn 5"), ("user", "turn 6"), ("model", "turn 7"), ("user", "turn 8")]
    assert contents[-1]["parts"][0]["text"].endswith("Question: and on Thursdays?")


def test_chat_parses_fenced_json_and_plain_text(ds, llm):
    llm.text = "```json\n" + json.dumps({"answer": "Fine.", "sources": [], "followups": []}) + "\n```"
    result = chat("How is today going?", at(ds, "2026-11-25 09:20"))
    assert result["answer"] == "Fine." and 1 <= len(result["followups"]) <= 3
    llm.text = "Not JSON at all."
    assert chat("Why?", at(ds, "2026-11-25 09:20"))["answer"] == "Not JSON at all."


def test_chat_llm_failures_are_unavailable(ds, llm):
    import urllib.error
    for error in (urllib.error.HTTPError("u", 429, "Too Many Requests", {}, None), TimeoutError(),
                  urllib.error.URLError("down")):
        llm.text = error
        with pytest.raises(ChatUnavailable):
            chat("Why?", at(ds, "2026-11-25 09:20"))
    llm.text = json.dumps({"answer": "", "sources": [], "followups": []})
    with pytest.raises(ChatUnavailable):
        chat("Why?", at(ds, "2026-11-25 09:20"))


def test_chat_retries_a_busy_llm_once(ds, llm, monkeypatch):
    import urllib.error
    replies = [urllib.error.HTTPError("u", 503, "Unavailable", {}, None), REPLY]

    def flaky(request, timeout):
        llm.text = replies.pop(0)
        return llm(request, timeout)

    monkeypatch.setattr("urllib.request.urlopen", flaky)
    monkeypatch.setattr("time.sleep", lambda s: None)
    assert chat("Why?", at(ds, "2026-11-25 09:20"))["answer"].startswith("ST-038")
    assert len(llm.calls) == 2


def test_chat_empty_question_does_not_call_the_llm(ds, llm):
    result = chat("  ", at(ds, "2026-11-25 09:20"))
    assert result["answer"] == "" and result["followups"] and not llm.calls


def test_suggestions(ds, monkeypatch):
    frames = at(ds, "2026-11-25 09:20")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(ChatUnavailable):
        suggestions(frames)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    assert suggestions(frames, role="Maintenance") == [
        "Why is OEE low on Wednesdays?", "What should Maintenance prepare for tomorrow?",
        "Which error costs us the most?", "How is today's shift going?"]
    assert suggestions(frames, code="ST-038") == [
        "Why does ST-038 happen?", "How much do we gain if we fix ST-038?",
        "When is ST-038 expected next?", "What should we do about ST-038?"]
    assert len(suggestions(frames, code="Q-031")) == 3
    assert suggestions(at(ds, "2026-11-03 10:00"))[0] == "What should we prepare for tomorrow?"


def test_chat_snapshot_is_small_and_fast(ds):
    import time
    frames = at(ds, "2026-11-30 14:00")
    start = time.perf_counter()
    snap = build_snapshot(frames, code="ST-038", role="Maintenance")
    assert time.perf_counter() - start < 1.0
    assert len(json.dumps(snap, separators=(",", ":"), default=str)) < 9000


def test_api_chat_routes(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.get("/api/chat/suggestions").status_code == 503
    assert client.post("/api/chat", json={"question": "Why?"}).status_code == 503

    fake = FakeLLM(REPLY)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("urllib.request.urlopen", fake)
    r = client.get("/api/chat/suggestions", params={"code": "ST-038", "role": "Maintenance"})
    assert r.status_code == 200 and r.json()[0] == "Why does ST-038 happen?"
    r = client.post("/api/chat", json={"question": "Why?", "code": "ST-038", "role": "Maintenance",
                                       "history": [{"role": "assistant", "text": "Hi"}]})
    assert r.status_code == 200 and set(r.json()) == {"answer", "sources", "followups"}
    assert fake.snapshot["focus_error"]["code"] == "ST-038" and fake.snapshot["user_role"] == "Maintenance"
    bad = client.post("/api/chat", json={"question": "x", "history": [{"role": "bot", "text": "x"}]})
    assert bad.status_code == 422

    fake.text = TimeoutError()  # the LLM times out: 503, never 500
    assert client.post("/api/chat", json={"question": "Why?"}).status_code == 503
