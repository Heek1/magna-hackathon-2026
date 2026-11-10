"""Write a sample response of every endpoint to frontend/src/mocks/*.json.

Run from backend/:  python scripts/dump_mocks.py [ISO sim time, default 2026-11-25T09:20:00]
The sample moment is Wednesday 2026-11-25 during the ST-038 camera stop, so active_downtime is set.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
os.environ["ACTIONS_DB"] = os.path.join(tempfile.mkdtemp(), "mocks.db")  # do not touch the real DB

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

MOCKS = BACKEND.parent / "frontend" / "src" / "mocks"
SIM_TIME = sys.argv[1] if len(sys.argv) > 1 else "2026-11-25T09:20:00"


def main() -> None:
    c = TestClient(app)
    MOCKS.mkdir(parents=True, exist_ok=True)
    samples = {
        "sim_control": c.post("/api/sim/control", json={"paused": True, "jump_to": SIM_TIME}),
        "state": c.get("/api/state"),
        "history": c.get("/api/history"),
        "heatmap": c.get("/api/heatmap", params={"metric": "oee"}),
        "losses": c.get("/api/losses"),
        "insights": c.get("/api/insights"),
        "whatif": c.post("/api/whatif", json={"remove": ["ST-038"], "from": "2026-11-02",
                                              "to": SIM_TIME[:10]}),
        "chat_503": c.post("/api/chat", json={"question": "Why is OEE below target on Wednesdays?"}),
    }
    c.post("/api/actions", json={"title": "Clean camera and check lighting before shift",
                                 "insight_id": "stub-1", "owner": "Maintenance"})
    second = c.post("/api/actions", json={"title": "Line and material ready before break ends",
                                          "insight_id": None, "owner": "Team leader"}).json()
    c.patch(f"/api/actions/{second['id']}", json={"status": "in_progress"})
    samples["actions"] = c.get("/api/actions")

    for name, resp in samples.items():
        body = {"status": resp.status_code, "body": resp.json()} if name == "chat_503" else resp.json()
        (MOCKS / f"{name}.json").write_text(json.dumps(body, indent=2, ensure_ascii=False) + "\n",
                                            encoding="utf-8")
        print(f"{name}.json  ({resp.status_code})")


if __name__ == "__main__":
    main()
