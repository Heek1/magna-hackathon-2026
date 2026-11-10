"""FastAPI app. Run from backend/:  uvicorn app.main:app --port 8000"""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import access, data, errors, insights_bridge, oee, report
from .db import ActionStore
from .sim import Simulator

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = os.environ.get("OEE_DATA", str(BACKEND_DIR.parent / "data" / "oee.xlsx"))
DB_PATH = os.environ.get("ACTIONS_DB", str(BACKEND_DIR / "actions.db"))
TICK_SECONDS = 1.0

sim = Simulator(data.load(DATA_PATH))
actions = ActionStore(DB_PATH)
fixes = errors.load_fixes()


async def _ticker() -> None:
    while True:
        await asyncio.sleep(TICK_SECONDS)
        sim.advance(TICK_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_ticker())
    yield
    task.cancel()


app = FastAPI(title="Magna OEE Improvement Engine", lifespan=lifespan)
access.install(app, os.environ.get("ACCESS_KEY"))  # private demo link; open when unset
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- state ----------

def build_state() -> dict:
    snap = sim.snapshot()
    today = snap.hours[snap.hours["Datum"].dt.date == snap.sim_time.date()]
    shift = oee.kpis(today)
    current_hour = int(today["Hodina_zmeny"].iloc[-1]) if not today.empty else 1
    hours = []
    for _, row in today.iterrows():
        hours.append({"date": row["Datum"].date().isoformat(), "hour": int(row["Hodina_zmeny"]),
                      **oee.kpis(row.to_frame().T)})
    return {
        "sim_time": snap.sim_time.isoformat(),
        "shift": {"date": snap.sim_time.date().isoformat(), "hour": current_hour, **shift},
        "hours": hours,
        "active_downtime": _english(sim.active_downtime()),
    }


def _english(active: dict | None) -> dict | None:
    return {**active, "device": errors.device_en(active["device"])} if active else None


@app.get("/api/state")
def get_state():
    return build_state()


async def state_events(is_disconnected):
    """SSE: an "state" event on every sim_time change, a comment every 15 s as keep-alive."""
    last = None
    idle = 0.0
    while not await is_disconnected():
        if sim.version != last:
            last = sim.version
            idle = 0.0
            yield f"event: state\ndata: {json.dumps(build_state())}\n\n"
        elif idle >= 15:
            idle = 0.0
            yield ": keep-alive\n\n"
        await asyncio.sleep(0.25)
        idle += 0.25


@app.get("/api/stream")
async def stream(request: Request):
    return StreamingResponse(state_events(request.is_disconnected), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- analytics ----------

@app.get("/api/history")
def get_history(from_: Annotated[date | None, Query(alias="from")] = None, to: date | None = None):
    return oee.history(sim.snapshot().hours, from_, to)


@app.get("/api/heatmap")
def get_heatmap(metric: str = "oee"):
    if metric not in oee.HEATMAP_METRICS:
        raise HTTPException(422, f"metric must be one of {oee.HEATMAP_METRICS}")
    return oee.heatmap(sim.snapshot().hours, metric)


@app.get("/api/losses")
def get_losses(from_: Annotated[date | None, Query(alias="from")] = None, to: date | None = None):
    snap = sim.snapshot()
    return errors.with_fix(oee.losses(snap.hours, snap.downtime, snap.nok, from_, to), fixes)


@app.get("/api/events")
def get_events(day: Annotated[date | None, Query(alias="date")] = None):
    snap = sim.snapshot()
    return errors.events(snap.hours, snap.downtime, snap.nok, day or snap.sim_time.date(),
                         snap.sim_time)


@app.get("/api/errors/{code}")
def get_error(code: str, from_: Annotated[date | None, Query(alias="from")] = None,
              to: date | None = None):
    snap = sim.snapshot()
    item = errors.detail(code, snap.hours, snap.downtime, snap.nok, fixes, snap.sim_time, from_, to)
    if item is None:
        raise HTTPException(404, f"error {code} does not occur up to sim_time")
    if item["kind"] == "stop":
        try:
            item["gain_pp"] = insights_bridge.whatif(snap.as_frames(), [code], from_, to)["gain_pp"]
        except Exception:  # keep the loss share as the estimate
            pass
    item["why"] = insights_bridge.why(snap.as_frames(), code)
    return item


@app.get("/api/upcoming")
def get_upcoming(hours: int = Query(48, ge=1, le=168)):
    return insights_bridge.upcoming(sim.snapshot().as_frames(), hours)


@app.get("/api/insights")
def get_insights():
    return insights_bridge.insights(sim.snapshot().as_frames())


class WhatIfIn(BaseModel):
    remove: list[str]
    from_: date | None = Field(None, alias="from")
    to: date | None = None


@app.post("/api/whatif")
def post_whatif(body: WhatIfIn):
    return insights_bridge.whatif(sim.snapshot().as_frames(), body.remove, body.from_, body.to)


class ChatIn(BaseModel):
    question: str


@app.post("/api/chat")
def post_chat(body: ChatIn):
    try:
        return {"answer": insights_bridge.answer(body.question, sim.snapshot().as_frames())}
    except Exception as exc:  # no LLM key or chat not available
        raise HTTPException(503, f"Chat unavailable: {exc}") from exc


# ---------- actions ----------

class ActionIn(BaseModel):
    title: str
    insight_id: str | None = None
    owner: str | None = None
    status: str = "open"


class ActionPatch(BaseModel):
    title: str | None = None
    insight_id: str | None = None
    owner: str | None = None
    status: str | None = None


@app.get("/api/actions")
def list_actions():
    return actions.list()


@app.post("/api/actions", status_code=201)
def create_action(body: ActionIn):
    try:
        return actions.create(**body.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.patch("/api/actions/{action_id}")
def patch_action(action_id: int, body: ActionPatch):
    try:
        updated = actions.update(action_id, **body.model_dump())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if updated is None:
        raise HTTPException(404, "action not found")
    return updated


# ---------- simulator ----------

class SimControlIn(BaseModel):
    speed: float | None = None
    jump_to: datetime | None = None
    paused: bool | None = None


@app.post("/api/sim/control")
def sim_control(body: SimControlIn):
    try:
        sim.control(body.speed, body.jump_to, body.paused)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"sim_time": sim.sim_time.isoformat(), "speed": sim.speed, "paused": sim.paused}


# ---------- stage 2 ----------

@app.get("/api/report")
def get_report(day: Annotated[date | None, Query(alias="date")] = None):
    snap = sim.snapshot()
    day = day or snap.sim_time.date()
    if not (snap.hours["Datum"].dt.date == day).any():
        raise HTTPException(404, f"no data for {day} up to sim_time {snap.sim_time.isoformat()}")
    return report.build(day, snap.hours, snap.downtime, snap.nok,
                        insights_bridge.insights(snap.as_frames()), actions.list())


@app.post("/api/upload")
async def upload(file: UploadFile):
    try:
        ds = data.load(await file.read())
    except data.DataError as exc:
        raise HTTPException(422, f"Invalid workbook: {exc}") from exc
    except Exception as exc:  # not an xlsx at all
        raise HTTPException(422, f"Cannot read file: {exc}") from exc
    sim.load(ds)
    sim.version += 1
    return {"rows": {"hours": len(ds.hours), "downtime": len(ds.downtime), "nok": len(ds.nok)},
            "sim_time": sim.sim_time.isoformat()}


# ---------- built frontend (one server for the public demo) ----------
# When STATIC_DIR points at `frontend/dist`, this app also serves the phone app, so a single
# container gives one public URL. Locally (vite dev server) the folder does not exist: API only.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", str(BACKEND_DIR.parent / "frontend" / "dist")))

if (STATIC_DIR / "index.html").is_file():
    from fastapi.responses import FileResponse

    _static_root = STATIC_DIR.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "not found")
        file = (_static_root / path).resolve()
        if path and file.is_file() and _static_root in file.parents:
            # Hashed assets can be cached for long; the service worker and index must stay fresh.
            cache = "no-cache" if file.name in ("sw.js", "index.html", "manifest.webmanifest") else "public, max-age=31536000, immutable"
            return FileResponse(file, headers={"Cache-Control": cache})
        return FileResponse(_static_root / "index.html", headers={"Cache-Control": "no-cache"})
