# Backend

FastAPI + pandas + SQLite on port 8000. API contract: [../CONTRACT.md](../CONTRACT.md).

## Run with Docker (backend + frontend)

From the repository root:

```bash
docker compose up --build
```

- Backend: http://localhost:8000 (docs at http://localhost:8000/docs)
- Frontend: http://localhost:5173 (needs `frontend/package.json` with a `dev` script)
- Optional: `GEMINI_API_KEY=... docker compose up` enables `/api/chat` (otherwise it returns 503).

## Run locally (Python 3.11)

From `backend/`:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Tests and frontend mocks:

```bash
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/dump_mocks.py                     # writes frontend/src/mocks/*.json
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `OEE_DATA` | `../data/oee.xlsx` | workbook loaded on start |
| `ACTIONS_DB` | `backend/actions.db` | SQLite file for `/api/actions` |
| `GEMINI_API_KEY` | — | used by `backend/insights` chat |

## Layout

| File | Purpose |
|---|---|
| `app/data.py` | xlsx loader, drops the `MESIAC` row, validates sheets and columns |
| `app/oee.py` | OEE KPIs from sums, history, heatmap, losses in pieces |
| `app/sim.py` | simulator (sim_time, speed, pause, jump) and data trimmed to sim_time |
| `app/db.py` | SQLite store for actions |
| `app/insights_bridge.py` | calls `backend/insights` (`get_insights`, `what_if`, `chat`), stubs until they exist |
| `app/report.py` | daily report for `/api/report` |
| `app/errors.py` | `/api/events`, `/api/errors/{code}`, `fix` on `/api/losses` (from `insights/countermeasures.json`) |
| `app/main.py` | FastAPI routes, CORS for :5173, SSE stream |

Simulator: starts at the first shift (2026-11-02 06:00), speed 60 (1 real second = 1 simulated
minute), moves only through shift windows and skips days not in the data. Control it with
`POST /api/sim/control {"speed": 120, "jump_to": "2026-11-25T08:30:00", "paused": false}`.
`POST /api/upload` (multipart field `file`) replaces the dataset and restarts the simulation.
