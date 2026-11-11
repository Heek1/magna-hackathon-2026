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


# ---------- Ask AI: chat with history, focus, role, cache (fake LLM, no network) ----------

import importlib  # noqa: E402

chat_module = importlib.import_module("insights.chat")  # the module; `chat` is also a function


class FakeLLM:
    """Stands in for chat._post; records each request and replies with `text`, per model if a dict."""

    def __init__(self, text, delays=None):
        self.text, self.delays, self.calls = text, delays or {}, []

    def __call__(self, url, headers, payload, timeout):
        import time as clock
        model = url.split("/models/")[1].split(":")[0]
        self.calls.append({"url": url, "model": model, "headers": headers, "body": json.loads(payload),
                           "timeout": timeout})
        clock.sleep(self.delays.get(model, 0))
        reply = self.text[model] if isinstance(self.text, dict) else self.text
        if isinstance(reply, Exception):
            raise reply
        return {"candidates": [{"content": {"parts": [{"text": reply}]}}]}

    @property
    def prompt(self):
        return self.calls[-1]["body"]["contents"][-1]["parts"][0]["text"]

    @property
    def snapshot(self):
        return json.loads(self.prompt.split("Snapshot:\n", 1)[1].split("\n\nQuestion: ", 1)[0])


REPLY = json.dumps({"answer": "ST-038 stops the camera every Wednesday at 09:08.",
                    "sources": ["ST-038 · 4 stops", "OEE by weekday", "", 7, "a", "b", "c"],
                    "followups": ["And on Thursdays?", "Who fixes it?", "How much do we gain?", "4th"]})
FALLBACK_REPLY = json.dumps({"answer": "From the fallback.", "sources": [], "followups": ["Next?"]})
BUSY = chat_module.ChatUnavailable("LLM service returned HTTP 503")


@pytest.fixture
def llm(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_FALLBACK_MODEL", raising=False)
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", Path(engine.__file__).with_name("countermeasures.json"))
    chat_module.clear_cache()
    fake = FakeLLM(REPLY)
    monkeypatch.setattr(chat_module, "_post", fake)
    yield fake
    chat_module.clear_cache()


def test_chat_returns_answer_sources_followups(ds, llm):
    result = chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"))
    assert result == {"answer": "ST-038 stops the camera every Wednesday at 09:08.",
                      "sources": ["ST-038 · 4 stops", "OEE by weekday", "a", "b"],
                      "followups": ["And on Thursdays?", "Who fixes it?", "How much do we gain?"]}
    call = llm.calls[0]
    assert "test-key" not in call["url"] and call["headers"]["x-goog-api-key"] == "test-key"
    assert call["model"] == "gemini-3.5-flash-lite" and call["timeout"] == 7
    config = call["body"]["generationConfig"]
    assert config["responseMimeType"] == "application/json" and config["maxOutputTokens"] <= 256
    assert config["thinkingConfig"] == {"thinkingLevel": "minimal"}
    assert "from the snapshot only" in call["body"]["system_instruction"]["parts"][0]["text"]
    assert llm.prompt.endswith("Question: Why is OEE low on Wednesdays?")


def test_chat_snapshot_is_compact(ds, llm):
    actions = [{"title": "Clean the camera light", "owner": "Maintenance", "status": "open"},
               {"title": "Old one", "owner": "Quality", "status": "done"}]
    chat("What should I prepare for tomorrow?", at(ds, "2026-11-25 09:20"), actions=actions)
    snap = llm.snapshot
    assert set(snap) == {"now", "role", "target_pct", "month", "today", "oee_by_weekday", "top_losses",
                         "patterns", "upcoming", "gains", "open_actions"}
    assert len(snap["top_losses"]) == 5 and len(snap["upcoming"]) <= 4
    assert "\n" not in llm.prompt.split("Snapshot:\n", 1)[1].split("\n\nQuestion", 1)[0]  # no pretty-printing
    assert len(llm.prompt) < 4000
    assert snap["upcoming"][0] == {"when": "tomorrow 08:08", "code": "ST-047", "what": "Test nest allows air leakage",
                                   "confidence": "high", "risk_pcs": 15.0,
                                   "fix": {"action": snap["upcoming"][0]["fix"]["action"], "owner_role": "Maintenance"}}
    assert snap["open_actions"] == [{"title": "Clean the camera light", "owner": "Maintenance", "status": "open"}]
    wednesday = next(d for d in snap["oee_by_weekday"] if d["day"] == "Wed")
    assert wednesday["oee_pct"] == min(d["oee_pct"] for d in snap["oee_by_weekday"])
    assert [s["code"] for s in snap["patterns"]["recurring_stops"]] == ["ST-038", "ST-047"]
    assert snap["patterns"]["recurring_stops"][0]["every"] == "Wed 09:08"


def test_chat_wednesday_question_focuses_on_st038_only(ds, llm):
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    focus = llm.snapshot["focus"]
    assert focus["weekday"] == "Wednesday" and focus["oee_pct"] < focus["other_days_oee_pct"]
    assert [s["code"] for s in focus["recurring_stops"]] == ["ST-038"]
    assert focus["recurring_stops"][0]["gain_if_fixed"]["gain_pp"] == 1.04
    assert "screwdriver" not in json.dumps(focus).lower()


def test_chat_snapshot_gains_match_what_if(ds, llm):
    chat("How much do we gain?", at(ds, "2026-11-30 14:00"))
    gains = {tuple(g["remove"]): g["gain_pp"] for g in llm.snapshot["gains"]}
    assert gains[("ST-038",)] == 1.0 and gains[("ST-047",)] == 0.6
    assert gains[("ST-038", "ST-047")] == 1.59
    assert gains[("slow_hour_1", "slow_hour_5")] == 1.14


def test_chat_snapshot_with_focus_code(ds, llm):
    chat("How much do we gain if we fix this?", at(ds, "2026-11-25 09:20"), code="ST-038")
    focus = llm.snapshot["focus"]
    assert focus["code"] == "ST-038" and focus["type"] == "stop" and focus["what"].startswith("Camera")
    assert focus["count"] == 4 and focus["when"] == ["Wed 09:08 ×4"]
    assert focus["why"].startswith("Stops every Wednesday at 09:08")
    assert focus["fix"]["owner_role"] == "Maintenance"
    assert focus["gain_if_fixed"]["gain_pp"] == 1.04  # the pitch: +1.04 pp at Nov 25 09:20
    assert focus["next"] == {"when": "Wed 02 Dec 09:08", "confidence": "high"}
    chat("How much do we gain if we fix this?", at(ds, "2026-11-30 14:00"), code="ST-038")
    assert llm.snapshot["focus"]["gain_if_fixed"]["gain_pp"] == 1.0  # full month
    for code, kind in (("Q-031", "defect"), ("microstop", "speed")):
        chat("Why?", at(ds, "2026-11-30 14:00"), code=code)
        assert llm.snapshot["focus"]["type"] == kind
    chat("Why?", at(ds, "2026-11-30 14:00"), code="ST-999")
    assert llm.snapshot["focus"] == {"code": "ST-999", "note": "no occurrences"}


def test_chat_sends_the_last_six_turns(ds, llm):
    history = [{"role": "user" if n % 2 == 0 else "assistant", "text": f"turn {n}"} for n in range(9)]
    history.append({"role": "user", "text": "   "})
    chat("and on Thursdays?", at(ds, "2026-11-25 09:20"), history=history)
    contents = llm.calls[0]["body"]["contents"]
    assert [(c["role"], c["parts"][0]["text"]) for c in contents[:-1]] == [
        ("user", "turn 4"), ("model", "turn 5"), ("user", "turn 6"), ("model", "turn 7"), ("user", "turn 8")]
    assert llm.snapshot["focus"]["weekday"] == "Thursday"


def test_chat_parses_fenced_cut_off_and_plain_text(ds, llm):
    llm.text = "```json\n" + json.dumps({"answer": "Fine.", "sources": [], "followups": []}) + "\n```"
    result = chat("How is today going?", at(ds, "2026-11-25 09:20"))
    assert result["answer"] == "Fine." and 1 <= len(result["followups"]) <= 3
    llm.text = '{"answer": "Cut off \\"here\\" by the token limit", "sources": ["ST'
    assert chat("Cut?", at(ds, "2026-11-25 09:20"))["answer"] == 'Cut off "here" by the token limit'
    llm.text = "Not JSON at all."
    assert chat("Why?", at(ds, "2026-11-25 09:20"))["answer"] == "Not JSON at all."


def test_chat_llm_failures_are_unavailable(ds, llm):
    llm.text = BUSY
    with pytest.raises(ChatUnavailable):
        chat("Why?", at(ds, "2026-11-25 09:20"))
    assert [c["model"] for c in llm.calls] == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    llm.text = json.dumps({"answer": "", "sources": [], "followups": []})
    with pytest.raises(ChatUnavailable):
        chat("Why?", at(ds, "2026-11-25 09:20"))


def test_chat_cache_reuses_the_answer(ds, llm):
    frames = at(ds, "2026-11-25 09:20")
    first = chat("Why is OEE low on Wednesdays?", frames, role="Maintenance")
    again = chat("why is OEE low on wednesdays", at(ds, "2026-11-25 09:30"), role="Maintenance")
    assert again == first and len(llm.calls) == 1
    chat("Why is OEE low on Wednesdays?", frames, role="Quality")              # other role
    chat("Why is OEE low on Wednesdays?", frames, role="Maintenance", code="ST-038")  # other screen
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-26 09:20"), role="Maintenance")  # other day
    assert len(llm.calls) == 4
    # before ST-038 started (08:30: one stop today) the answer differs; 09:10 has the same stops as 09:20
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 08:30"), role="Maintenance")
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:10"), role="Maintenance")
    assert len(llm.calls) == 5
    llm.text = BUSY  # failures are not cached (both models tried)
    with pytest.raises(ChatUnavailable):
        chat("Fails?", frames)
    llm.text = REPLY
    chat("Fails?", frames)
    assert len(llm.calls) == 8


def test_chat_cache_expires(ds, llm, monkeypatch):
    frames = at(ds, "2026-11-25 09:20")
    chat("Why?", frames)
    monkeypatch.setattr(chat_module, "CACHE_TTL_S", -1)
    chat_module.clear_cache()
    chat("Why?", frames)
    chat("Why?", frames)
    assert len(llm.calls) == 3


def test_chat_falls_back_when_the_primary_model_is_busy(ds, llm):
    llm.text = {"gemini-3.5-flash-lite": BUSY, "gemini-3.6-flash": FALLBACK_REPLY}
    assert chat("Why?", at(ds, "2026-11-25 09:20"))["answer"] == "From the fallback."
    assert [c["model"] for c in llm.calls] == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]


def test_chat_races_the_fallback_against_a_slow_primary(ds, llm, monkeypatch):
    import time
    monkeypatch.setattr(chat_module, "HEDGE_S", 0.2)
    llm.text = {"gemini-3.5-flash-lite": REPLY, "gemini-3.6-flash": FALLBACK_REPLY}
    llm.delays = {"gemini-3.5-flash-lite": 1.5}
    start = time.perf_counter()
    assert chat("Why?", at(ds, "2026-11-25 09:20"))["answer"] == "From the fallback."
    assert time.perf_counter() - start < 1.2


def test_chat_times_out(ds, llm, monkeypatch):
    import time
    monkeypatch.setattr(chat_module, "TIMEOUT_S", 0.5)
    monkeypatch.setattr(chat_module, "HEDGE_S", 0.1)
    llm.delays = {"gemini-3.5-flash-lite": 2, "gemini-3.6-flash": 2}
    start = time.perf_counter()
    with pytest.raises(ChatUnavailable, match="within"):
        chat("Why?", at(ds, "2026-11-25 09:20"))
    assert time.perf_counter() - start < 1.0


def test_chat_models_are_configurable(ds, llm, monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "my-model")
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "")
    llm.text = BUSY
    with pytest.raises(ChatUnavailable):
        chat("Why?", at(ds, "2026-11-25 09:20"))
    assert [c["model"] for c in llm.calls] == ["my-model"]


def test_chat_empty_question_does_not_call_the_llm(ds, llm):
    result = chat("  ", at(ds, "2026-11-25 09:20"))
    assert result["answer"] == "" and result["followups"] and not llm.calls


def test_warm_up_answers_the_starters_in_the_background(ds, llm):
    frames = at(ds, "2026-11-25 08:30")
    assert chat_module.warm_up(frames, "Maintenance") == 4
    assert chat_module.warm_up(frames, "Maintenance") == 0  # already queued
    chat_module._warm_pool.submit(lambda: None).result(timeout=10)  # wait for the queue
    assert len(llm.calls) == 4
    for question in suggestions(frames, role="Maintenance"):
        chat(question, frames, role="Maintenance")
    assert len(llm.calls) == 4  # every starter answered from the cache
    assert chat_module.warm_up(at(ds, "2026-11-02 06:00")) == 0  # no data yet


def test_warm_up_without_key_does_nothing(ds, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert chat_module.warm_up(at(ds, "2026-11-25 08:30")) == 0


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
    assert len(json.dumps(snap, separators=(",", ":"), default=str, ensure_ascii=False)) < 3500


def test_api_chat_routes(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    monkeypatch.setattr(insights_bridge, "_warm_up", None)  # no background calls in this test
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.get("/api/chat/suggestions").status_code == 503
    assert client.post("/api/chat", json={"question": "Why?"}).status_code == 503

    chat_module.clear_cache()
    fake = FakeLLM(REPLY)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(chat_module, "_post", fake)
    r = client.get("/api/chat/suggestions", params={"code": "ST-038", "role": "Maintenance"})
    assert r.status_code == 200 and r.json()[0] == "Why does ST-038 happen?"
    r = client.post("/api/chat", json={"question": "Why?", "code": "ST-038", "role": "Maintenance",
                                       "history": [{"role": "assistant", "text": "Hi"}]})
    assert r.status_code == 200 and set(r.json()) == {"answer", "sources", "followups"}
    assert fake.snapshot["focus"]["code"] == "ST-038" and fake.snapshot["role"] == "Maintenance"
    bad = client.post("/api/chat", json={"question": "x", "history": [{"role": "bot", "text": "x"}]})
    assert bad.status_code == 422

    fake.text = BUSY  # both models busy: 503, never 500
    assert client.post("/api/chat", json={"question": "Busy?"}).status_code == 503
    chat_module.clear_cache()


# ---------- Ask AI accuracy: numbers come from the snapshot ----------

def test_unverified_numbers():
    source = '{"oee_pct":81.9,"downtime_min":121.0,"gain_pp":1.04,"every":"Wed 09:08","loss_pcs":87.0,"now":"2026-11-25 Wed 09:20"}'
    ok = "Wednesday OEE is 81.9 % with 121 min of downtime: ST-038 stops every Wed at 09:08 (4 of 4 weeks), 87 pcs, +1.04 pp."
    assert chat_module.unverified_numbers(ok, source) == []
    assert chat_module.unverified_numbers("On 2026-11-25 at 09:20, slow_hour_1 and Q-031.", source) == []
    bad = "OEE is 82.4 %, fixing it gives +1.1 pp and 92 pcs."
    assert chat_module.unverified_numbers(bad, source) == ["1.1", "82.4", "92"]


def test_chat_logs_numbers_that_are_not_in_the_snapshot(ds, llm, caplog):
    import logging
    llm.text = json.dumps({"answer": "Wednesday OEE is 81.9 %; fixing ST-038 gives +7.77 pp.", "sources": [],
                           "followups": []})
    with caplog.at_level(logging.WARNING, logger="oee.chat"):
        chat_module.log.propagate = True
        try:
            chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"))
        finally:
            chat_module.log.propagate = False
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1 and "['7.77']" in warnings[0]  # 81.9 is in the snapshot, 7.77 is not


def test_chat_prompt_rules(ds, llm):
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    system = llm.calls[0]["body"]["system_instruction"]["parts"][0]["text"]
    for rule in ("Answer ONLY the question asked", "Mention a countermeasure only for the codes",
                 "Never add fixes, codes or facts", "say what the data shows and stop",
                 "never the JSON field names", "never write as the user or as their role"):
        assert rule in system
    # the Wednesday snapshot carries no other code's fix in its focus
    focus = json.dumps(llm.snapshot["focus"])
    assert "ST-038" in focus and not any(c in focus for c in ("ST-047", "Q-026", "Q-020", "ST-001"))


def test_api_chat_times_out_with_503(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    monkeypatch.setattr(insights_bridge, "_warm_up", None)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(chat_module, "TIMEOUT_S", 0.4)
    monkeypatch.setattr(chat_module, "HEDGE_S", 0.1)
    chat_module.clear_cache()
    monkeypatch.setattr(chat_module, "_post", FakeLLM(REPLY, delays={"gemini-3.5-flash-lite": 2, "gemini-3.6-flash": 2}))
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    r = client.post("/api/chat", json={"question": "Slow?"})
    assert r.status_code == 503 and "within" in r.json()["detail"]


# ---------- Ask AI never breaks the demo: engine-data answers when the LLM fails ----------

fallback_module = importlib.import_module("insights.fallback")
STARTERS = ["Why is OEE low on Wednesdays?", "What should Maintenance prepare for tomorrow?",
            "Which error costs us the most?", "How is today's shift going?"]


@pytest.fixture
def real_fixes(monkeypatch):
    monkeypatch.setattr(engine, "COUNTERMEASURES_PATH", Path(engine.__file__).with_name("countermeasures.json"))


def test_fallback_answers_the_starters_from_engine_data(ds, real_fixes):
    frames = at(ds, "2026-11-25 09:20")
    expected = {
        STARTERS[0]: "OEE on Wednesdays is 81.9 % against 89.5 % on the other days, with 121 min of downtime. "
                     "ST-038 (Camera: Camera light module interrupted operation) stops every Wed 09:08 "
                     "(4 of 4 weeks), 87 pcs so far; fixing it gives +1.04 pp.",
        STARTERS[1]: "Tomorrow 08:08: ST-047 (Test nest allows air leakage), high confidence, ~15 pcs at risk. "
                     "Fix (Maintenance): Replace worn test nest sealing gaskets on a weekly preventive "
                     "maintenance schedule.",
        STARTERS[2]: "Slowdown costs the most: 272.1 pcs this month. Then Microstops 162.5 pcs and ST-038 87 pcs.",
        STARTERS[3]: "Today's OEE is 76.4 % (8.6 pp below the 85 % target): 44.9 pcs lost and 25 min of "
                     "downtime so far.",
    }
    for question, text in expected.items():
        snap = build_snapshot(frames, None, "Maintenance", [], question)
        result = fallback_module.answer(question, snap, None, "Maintenance", STARTERS)
        assert result["answer"] == text and result["sources"] == ["Engine data"]
        assert question not in result["followups"] and len(result["followups"]) == 3
        assert chat_module.unverified_numbers(text, json.dumps(snap)) == []


def test_fallback_answers_error_detail_questions(ds, real_fixes):
    for moment, gain in (("2026-11-25 09:20", "+1.04 pp OEE (80.1 pcs): OEE 88.0 % → 89.1 %"),
                         ("2026-11-30 14:00", "+1.00 pp OEE (92.1 pcs): OEE 88.0 % → 89.0 %")):
        frames = at(ds, moment)
        snap = build_snapshot(frames, "ST-038", None, [], "How much do we gain if we fix this?")
        assert fallback_module.answer("How much do we gain if we fix this?", snap, "ST-038")["answer"] == (
            f"Fixing ST-038 gives {gain}.")
    snap = build_snapshot(at(ds, "2026-11-25 09:20"), "ST-038")
    assert fallback_module.answer("Why does ST-038 happen?", snap, "ST-038")["answer"].startswith(
        "Stops every Wednesday at 09:08")
    assert fallback_module.answer("When is ST-038 expected next?", snap, "ST-038")["answer"] == (
        "ST-038 is expected next Wed 02 Dec 09:08 (high confidence).")
    assert fallback_module.answer("What should we do about ST-038?", snap, "ST-038")["answer"].startswith(
        "Fix (Maintenance): Inspect, clean")


def test_fallback_does_not_guess(ds):
    snap = build_snapshot(at(ds, "2026-11-25 09:20"), None, None, [], "What is the weather?")
    assert fallback_module.answer("What is the weather?", snap) is None
    assert fallback_module.answer("Why?", build_snapshot(at(ds, "2026-11-02 06:00"))) is None


def test_chat_answers_from_engine_data_when_the_llm_fails(ds, llm):
    llm.text = BUSY
    result = chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    assert result["sources"] == ["Engine data"] and "+1.04 pp" in result["answer"]
    assert [c["model"] for c in llm.calls] == ["gemini-3.5-flash-lite", "gemini-3.6-flash"]
    llm.text = REPLY  # the engine answer is not cached: the next tap asks the LLM again
    again = chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    assert again["sources"] != ["Engine data"] and len(llm.calls) == 3


def test_chat_answers_from_engine_data_when_the_llm_is_slow(ds, llm, monkeypatch):
    import time
    monkeypatch.setattr(chat_module, "TIMEOUT_S", 0.4)
    monkeypatch.setattr(chat_module, "HEDGE_S", 0.1)
    llm.delays = {"gemini-3.5-flash-lite": 2, "gemini-3.6-flash": 2}
    start = time.perf_counter()
    result = chat("How much do we gain if we fix this?", at(ds, "2026-11-25 09:20"), code="ST-038")
    assert result["answer"].startswith("Fixing ST-038 gives +1.04 pp") and time.perf_counter() - start < 1.0
    llm.text = json.dumps({"answer": "", "sources": [], "followups": []})  # an empty answer too
    llm.delays = {}
    assert chat("Which error costs us the most?", at(ds, "2026-11-25 09:20"))["sources"] == ["Engine data"]


def test_api_answers_from_engine_data_and_503_only_when_both_fail(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    monkeypatch.setattr(insights_bridge, "_warm_up", None)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    chat_module.clear_cache()
    monkeypatch.setattr(chat_module, "_post", FakeLLM(BUSY))
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    r = client.post("/api/chat", json={"question": "What should Maintenance prepare for tomorrow?", "role": "Maintenance"})
    assert r.status_code == 200 and r.json()["answer"].startswith("Tomorrow 08:08: ST-047")
    assert r.json()["sources"] == ["Engine data"]
    assert client.post("/api/chat", json={"question": "Tell me a joke"}).status_code == 503



# ---------- Ask AI speed on a small CPU: shared snapshot part, Error detail warm-up ----------

def test_snapshot_shares_the_costly_part_between_questions(ds, llm, monkeypatch):
    calls = []
    real = chat_module.get_insights
    monkeypatch.setattr(chat_module, "get_insights", lambda data: calls.append(1) or real(data))
    frames = at(ds, "2026-11-25 09:20")
    for question in STARTERS:
        build_snapshot(frames, None, "Maintenance", [], question)
    build_snapshot(at(ds, "2026-11-25 09:22"), "ST-038")  # same 5-minute slot
    assert len(calls) == 1
    build_snapshot(at(ds, "2026-11-25 09:30"))  # the next slot is computed again
    assert len(calls) == 2


def test_warm_up_on_error_detail_answers_why_and_gain(ds, llm):
    frames = at(ds, "2026-11-25 09:20")
    assert chat_module.warm_up(frames, "Maintenance", code="ST-038") == 2
    chat_module._warm_pool.submit(lambda: None).result(timeout=10)
    assert len(llm.calls) == 2 and all(c["body"]["contents"][-1]["parts"][0]["text"].count('"focus":{"code":"ST-038"') == 1
                                      for c in llm.calls)
    chat("How much do we gain if we fix ST-038?", frames, code="ST-038", role="Maintenance")
    chat("Why does ST-038 happen?", frames, code="ST-038", role="Maintenance")
    assert len(llm.calls) == 2  # both from the cache


def test_api_suggestions_warm_up_the_screen(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    warmed = []
    monkeypatch.setattr(insights_bridge, "_warm_up",
                        lambda data, role, code=None, lang="en": warmed.append((role, code)))
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    client = TestClient(app)
    client.get("/api/chat/suggestions", params={"role": "Maintenance"})
    client.get("/api/chat/suggestions", params={"role": "Maintenance", "code": "ST-038"})
    assert warmed == [("Maintenance", None), ("Maintenance", "ST-038")]


def test_a_tap_during_the_warm_up_waits_for_it_instead_of_asking_twice(ds, llm):
    import threading
    import time
    frames = at(ds, "2026-11-25 09:20")
    release = threading.Event()
    real = llm.__call__

    def slow(url, headers, payload, timeout):  # the warm-up's LLM call takes a while
        release.wait(5)
        return real(url, headers, payload, timeout)

    chat_module._post = slow
    assert chat_module.warm_up(frames, "Maintenance") == 4
    time.sleep(0.2)  # the first starter is now running
    first = STARTERS[0]
    threading.Timer(0.3, release.set).start()
    answer = chat(first, frames, role="Maintenance")  # tapped while it is being warmed up
    assert answer["answer"].startswith("ST-038")
    chat_module._warm_pool.submit(lambda: None).result(timeout=20)
    asked = [c["body"]["contents"][-1]["parts"][0]["text"].endswith(f"Question: {first}") for c in llm.calls]
    assert sum(asked) == 1 and len(llm.calls) == 4  # the tapped question went to the LLM once, not twice


def test_a_tap_on_a_queued_question_asks_live_and_the_warm_up_skips_it(ds, llm):
    import threading
    import time
    frames = at(ds, "2026-11-25 09:20")
    release = threading.Event()
    real = llm.__call__

    def slow(url, headers, payload, timeout):
        if "Why is OEE low" in json.loads(payload)["contents"][-1]["parts"][0]["text"]:
            release.wait(5)
        return real(url, headers, payload, timeout)

    chat_module._post = slow
    chat_module.warm_up(frames, "Maintenance")
    time.sleep(0.2)
    chat(STARTERS[3], frames, role="Maintenance")  # still queued behind the first: asked live
    release.set()
    chat_module._warm_pool.submit(lambda: None).result(timeout=20)
    assert len(llm.calls) == 4  # the warm-up did not ask the fourth again



# ---------- Ask AI in Slovak ----------

lang_module = importlib.import_module("insights.lang")
SK_STARTERS = ["Prečo je OEE v stredu nízke?", "Čo má údržba pripraviť na zajtra?",
               "Ktorá chyba nás stojí najviac?", "Ako ide dnešná zmena?"]


def test_language_detection():
    for question in SK_STARTERS + ["Preco je OEE v stredu nizke?", "Aky je stav pre ST-038?",
                                   "Kolko ziskame, ak opravime ST-038?", "Kedy sa ST-038 očakáva najbližšie?"]:
        assert lang_module.detect(question) == "sk", question
    for question in STARTERS + ["How much do we gain if we fix ST-038?", "and on Thursdays?", "Why?"]:
        assert lang_module.detect(question) == "en", question


def test_slovak_question_gets_a_slovak_instruction_and_the_weekday_focus(ds, llm):
    chat("Prečo je OEE v stredu nízke?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    prompt = llm.prompt
    assert prompt.startswith("Answer language: Slovak (slovenčina)") and "diacritics" in prompt
    assert prompt.endswith("Question: Prečo je OEE v stredu nízke?")
    assert llm.snapshot["focus"]["weekday"] == "Wednesday"
    system = llm.calls[0]["body"]["system_instruction"]["parts"][0]["text"]
    assert "answer language named in the last message" in system
    chat("Why is OEE low on Wednesdays?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    assert llm.prompt.startswith("Answer language: English.")


def test_cache_separates_languages(ds, llm):
    frames = at(ds, "2026-11-25 09:20")
    chat("Prečo je OEE v stredu nízke?", frames, role="Maintenance")
    chat("Prečo je OEE v stredu nízke?", frames, role="Maintenance")
    chat("Why is OEE low on Wednesdays?", frames, role="Maintenance")
    assert len(llm.calls) == 2
    keys = {chat_module._cache_key("Ako ide dnešná zmena?", None, None, [], frames, lang) for lang in ("en", "sk")}
    assert len(keys) == 2


def test_slovak_starters(ds, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    frames = at(ds, "2026-11-25 09:20")
    assert suggestions(frames, role="Maintenance", lang="sk") == SK_STARTERS
    assert suggestions(frames, lang="sk")[1] == "Čo máme pripraviť na zajtra?"
    assert suggestions(frames, code="ST-038", role="Maintenance", lang="sk") == [
        "Prečo vzniká ST-038?", "Koľko získame, ak opravíme ST-038?",
        "Kedy sa ST-038 očakáva najbližšie?", "Ako má údržba riešiť ST-038?"]


def test_slovak_fallback_answers(ds, real_fixes):
    frames = at(ds, "2026-11-25 09:20")
    expected = {
        SK_STARTERS[0]: "OEE v stredu je 81,9 % oproti 89,5 % v ostatných dňoch, pri 121 min prestojov. ST-038 "
                        "(Camera: Camera light module interrupted operation) zastavuje linku každú stredu o 09:08 "
                        "(4 zo 4 týždňov), doteraz 87 ks; jeho odstránenie prinesie +1,04 p. b. OEE.",
        SK_STARTERS[1]: "Zajtra o 08:08: ST-047 (Test nest allows air leakage) s vysokou pravdepodobnosťou, ohrozených "
                        "~15 ks. Opatrenie (Maintenance): Replace worn test nest sealing gaskets on a weekly "
                        "preventive maintenance schedule.",
        SK_STARTERS[2]: "Najviac nás stojí spomalenie: 272,1 ks za tento mesiac. Nasledujú mikroprestoje (162,5 ks) "
                        "a ST-038 (87 ks).",
        SK_STARTERS[3]: "Dnešné OEE je 76,4 % (8,6 p. b. pod cieľom 85 %): doteraz 44,9 ks strát a 25 min prestojov.",
    }
    for question, text in expected.items():
        snap = build_snapshot(frames, None, "Maintenance", [], question)
        result = fallback_module.answer(question, snap, None, "Maintenance", SK_STARTERS, "sk")
        assert result["answer"] == text and result["sources"] == ["Dáta systému"]
        assert chat_module.unverified_numbers(text, json.dumps(snap)) == []  # decimal commas included
    snap = build_snapshot(frames, "ST-038")
    for question, text in (
            ("Koľko získame, ak opravíme ST-038?", "Odstránenie ST-038 prinesie +1,04 p. b. OEE (80,1 ks): OEE 88,0 % → 89,1 %."),
            ("Kedy sa ST-038 očakáva najbližšie?", "ST-038 sa najbližšie očakáva v stredu 2. 12. o 09:08 s vysokou pravdepodobnosťou."),
            ("Prečo vzniká ST-038?", "ST-038 zastavuje linku každú stredu o 09:08 (4-krát), spolu 87 min a 87 ks — "
                                     "pravidelný vzorec, nie náhodné opotrebenie.")):
        assert fallback_module.answer(question, snap, "ST-038", lang="sk")["answer"] == text
    month = build_snapshot(at(ds, "2026-11-30 14:00"), "ST-038")
    assert "+1,00 p. b. OEE (92,1 ks)" in fallback_module.answer("Koľko získame, ak opravíme ST-038?", month, "ST-038", lang="sk")["answer"]


def test_slovak_question_falls_back_in_slovak(ds, llm):
    llm.text = BUSY
    result = chat("Čo má údržba pripraviť na zajtra?", at(ds, "2026-11-25 09:20"), role="Maintenance")
    assert result["answer"].startswith("Zajtra o 08:08: ST-047") and result["sources"] == ["Dáta systému"]
    assert result["followups"] == ["Prečo je OEE v stredu nízke?", "Ktorá chyba nás stojí najviac?", "Ako ide dnešná zmena?"]


def test_api_suggestions_in_slovak_warm_up_slovak(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    warmed = []
    monkeypatch.setattr(insights_bridge, "_warm_up",
                        lambda data, role, code=None, lang="en": warmed.append((role, code, lang)))
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    r = client.get("/api/chat/suggestions", params={"role": "Maintenance", "lang": "sk"})
    assert r.status_code == 200 and r.json() == SK_STARTERS
    assert client.get("/api/chat/suggestions", params={"lang": "de"}).status_code == 422
    assert warmed == [("Maintenance", None, "sk")]


def test_warm_up_in_slovak(ds, llm):
    frames = at(ds, "2026-11-25 09:20")
    assert chat_module.warm_up(frames, "Maintenance", lang="sk") == 4
    chat_module._warm_pool.submit(lambda: None).result(timeout=10)
    assert all(c["body"]["contents"][-1]["parts"][0]["text"].startswith("Answer language: Slovak") for c in llm.calls)
    for question in SK_STARTERS:
        chat(question, frames, role="Maintenance")
    assert len(llm.calls) == 4  # all from the cache



# ---------- quota safety: 429 logged, second key, used-up quota skipped ----------

def _quota_429(retry_s=25602.0):
    return chat_module.QuotaExceeded("LLM service returned HTTP 429 (quota GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit 20)",
                                     "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "20", retry_s)


class KeyedLLM(FakeLLM):
    """Replies per (model, key): a value or an exception."""

    def __init__(self, table):
        super().__init__(REPLY)
        self.table = table

    def __call__(self, url, headers, payload, timeout):
        model = url.split("/models/")[1].split(":")[0]
        self.text = self.table.get((model, headers["x-goog-api-key"]), REPLY)
        return super().__call__(url, headers, payload, timeout)


def test_quota_error_is_parsed_from_the_429_body():
    class Response:
        def json(self):
            return {"error": {"details": [
                {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [
                    {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier", "quotaValue": "20"}]},
                {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "25602s"}]}}

    error = chat_module._quota_error(Response())
    assert (error.quota, error.limit, error.retry_s) == ("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "20", 25602.0)
    assert "resets in 427 min" in str(error)


def test_second_key_is_tried_on_429_and_keys_are_never_logged(ds, llm, monkeypatch, caplog):
    import logging
    monkeypatch.setenv("GEMINI_API_KEY_2", "second-key")
    fake = KeyedLLM({("gemini-3.5-flash-lite", "test-key"): _quota_429()})
    monkeypatch.setattr(chat_module, "_post", fake)
    chat_module.log.propagate = True
    try:
        with caplog.at_level(logging.INFO, logger="oee.chat"):
            result = chat("Why?", at(ds, "2026-11-25 09:20"))
    finally:
        chat_module.log.propagate = False
    assert result["answer"].startswith("ST-038")
    assert [(c["model"], c["headers"]["x-goog-api-key"]) for c in fake.calls] == [
        ("gemini-3.5-flash-lite", "test-key"), ("gemini-3.5-flash-lite", "second-key")]
    logged = " ".join(r.getMessage() for r in caplog.records)
    assert "Gemini 429 QUOTA model=gemini-3.5-flash-lite key=#1" in logged and "limit=20" in logged
    assert "test-key" not in logged and "second-key" not in logged


def test_a_used_up_daily_quota_is_skipped_until_it_resets(ds, llm, monkeypatch):
    fake = KeyedLLM({("gemini-3.5-flash-lite", "test-key"): _quota_429()})
    monkeypatch.setattr(chat_module, "_post", fake)
    chat("First?", at(ds, "2026-11-25 09:20"))   # primary 429 -> fallback model answers
    chat("Second?", at(ds, "2026-11-25 09:20"))  # the primary is not asked again
    assert [c["model"] for c in fake.calls] == ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.6-flash"]


def test_a_per_minute_429_is_not_remembered(ds, llm, monkeypatch):
    fake = KeyedLLM({("gemini-3.5-flash-lite", "test-key"): _quota_429(retry_s=20)})
    monkeypatch.setattr(chat_module, "_post", fake)
    chat("First?", at(ds, "2026-11-25 09:20"))
    chat("Second?", at(ds, "2026-11-25 09:20"))
    assert [c["model"] for c in fake.calls].count("gemini-3.5-flash-lite") == 2


def test_api_never_returns_the_keys(ds, monkeypatch):
    from fastapi.testclient import TestClient

    from app import insights_bridge
    from app.main import app

    monkeypatch.setattr(insights_bridge, "_warm_up", None)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_API_KEY_2", "second-key")
    chat_module.clear_cache()
    monkeypatch.setattr(chat_module, "_post", KeyedLLM({(m, k): _quota_429() for m in ("gemini-3.5-flash-lite", "gemini-3.6-flash")
                                                        for k in ("test-key", "second-key")}))
    client = TestClient(app)
    client.post("/api/sim/control", json={"paused": True, "jump_to": "2026-11-25T09:20:00"})
    r = client.post("/api/chat", json={"question": "Tell me a joke"})
    assert r.status_code == 503 and "429" in r.text
    assert "test-key" not in r.text and "second-key" not in r.text
    chat_module.clear_cache()
