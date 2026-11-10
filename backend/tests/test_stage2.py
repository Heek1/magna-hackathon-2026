import io

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

from .conftest import DATA_PATH

client = TestClient(app)


def _jump(t):
    client.post("/api/sim/control", json={"paused": True, "jump_to": t})


def test_report_shape_and_numbers():
    _jump("2026-11-04T14:00:00")
    r = client.get("/api/report", params={"date": "2026-11-04"})
    assert r.status_code == 200
    rep = r.json()
    assert set(rep) == {"date", "kpis", "top_losses", "insights", "actions", "summary"}
    assert rep["kpis"]["oee"] == 0.8159  # Kontrola_zmien 2026-11-04
    assert len(rep["top_losses"]) <= 5
    assert "2026-11-04" in rep["summary"] and "below" in rep["summary"]


def test_report_defaults_to_sim_date_and_hides_future():
    _jump("2026-11-10T09:00:00")
    assert client.get("/api/report").json()["date"] == "2026-11-10"
    assert client.get("/api/report", params={"date": "2026-11-11"}).status_code == 404


def test_upload_replaces_dataset():
    xlsx = DATA_PATH.read_bytes()
    r = client.post("/api/upload", files={"file": ("oee.xlsx", xlsx)})
    assert r.status_code == 200
    assert r.json()["rows"] == {"hours": 168, "downtime": 33, "nok": 112}
    assert r.json()["sim_time"] == "2026-11-02T06:00:00"


def test_upload_rejects_bad_files():
    assert client.post("/api/upload", files={"file": ("x.xlsx", b"not excel")}).status_code == 422
    buf = io.BytesIO()
    with pd.ExcelWriter(buf) as w:
        pd.DataFrame({"a": [1]}).to_excel(w, sheet_name="Vyroba_hodiny", index=False)
    r = client.post("/api/upload", files={"file": ("bad.xlsx", buf.getvalue())})
    assert r.status_code == 422
