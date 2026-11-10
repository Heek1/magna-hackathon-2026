# Magna Hackathon 2026 — AI OEE Improvement Engine

Shared context, formulas and API contract: [CONTRACT.md](CONTRACT.md). Data: `data/oee.xlsx`.

## Team and ownership

| Member | Branch | Owned folders | Task |
|---|---|---|---|
| 1 — Backend core + Top errors, Error detail, Fixes screens | `feat/backend-core` | `backend/` (except `backend/insights/`), `frontend/src/pages/analysis`, `frontend/src/pages/actions` | [docs/tasks/1-backend-core.md](docs/tasks/1-backend-core.md) |
| 2 — Insights | `feat/insights` | `backend/insights/` (except `countermeasures.json`) | [docs/tasks/2-insights.md](docs/tasks/2-insights.md) |
| 3 — Frontend + Live | `feat/frontend-live` | `frontend/` (except `src/pages/analysis` and `src/pages/actions`) | [docs/tasks/3-frontend-live.md](docs/tasks/3-frontend-live.md) |
| 4 — Knowledge base, pitch | `feat/kb-analysis-qa` | `backend/insights/countermeasures.json`, `docs/pitch.md` | [docs/tasks/4-kb-analysis-qa.md](docs/tasks/4-kb-analysis-qa.md) |

## Rules

- Nobody pushes to `main` directly — every change goes through a pull request, and each member merges their own PRs.
- Each member changes **only their own folders** (see the table).
- Small, frequent commits; push at least once an hour.
- Contract changes go through the team lead only.
- Before every integration point, rebase onto `main`:
  `git fetch origin && git rebase origin/main`, then `git push --force-with-lease`.

## Integration points

- Hour 8 — integration 1
- Hour 16 — integration 2
- Hour 20 — integration 3, **feature freeze**

## Getting started

```bash
git clone https://github.com/Heek1/magna-hackathon-2026.git
cd magna-hackathon-2026
git checkout <your-branch>
```

## Public demo (one container)

The root `Dockerfile` builds the phone app and serves it together with the API on one port, so the
demo has a single public URL that opens on any phone.

```bash
docker build -t oee-engine .
docker run -p 8000:8000 oee-engine      # http://localhost:8000
```

Hosting platforms set `PORT`; the container listens on it. Actions are kept in `/app/state/actions.db`
inside the container (reset on redeploy).
