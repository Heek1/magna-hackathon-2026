"""SQLite storage for /api/actions."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

STATUSES = ("open", "in_progress", "done")
FIELDS = ("id", "insight_id", "title", "owner", "status", "created_at")


class ActionStore:
    def __init__(self, path: str):
        self.path = path
        with self._conn() as c:
            c.execute(
                "CREATE TABLE IF NOT EXISTS actions ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, insight_id TEXT, title TEXT NOT NULL, "
                "owner TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL)"
            )

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def list(self) -> list[dict]:
        with self._conn() as c:
            return [dict(r) for r in c.execute(f"SELECT {', '.join(FIELDS)} FROM actions ORDER BY id")]

    def get(self, action_id: int) -> dict | None:
        with self._conn() as c:
            r = c.execute(f"SELECT {', '.join(FIELDS)} FROM actions WHERE id = ?", (action_id,)).fetchone()
        return dict(r) if r else None

    def create(self, title: str, insight_id: str | None = None, owner: str | None = None,
               status: str = "open") -> dict:
        _check_status(status)
        created = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO actions (insight_id, title, owner, status, created_at) VALUES (?, ?, ?, ?, ?)",
                (insight_id, title, owner, status, created),
            )
            new_id = cur.lastrowid
        return self.get(new_id)

    def update(self, action_id: int, **changes) -> dict | None:
        changes = {k: v for k, v in changes.items() if k in ("insight_id", "title", "owner", "status")
                   and v is not None}
        if "status" in changes:
            _check_status(changes["status"])
        if changes:
            sets = ", ".join(f"{k} = ?" for k in changes)
            with self._conn() as c:
                c.execute(f"UPDATE actions SET {sets} WHERE id = ?", (*changes.values(), action_id))
        return self.get(action_id)


def _check_status(status: str) -> None:
    if status not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}")
