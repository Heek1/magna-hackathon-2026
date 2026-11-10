PROJECT CONTEXT (identical for the whole team; do not change the contract on your own)
Magna Hackathon, 24 hours, challenge 5 "AI OEE Improvement Engine": automatic root-cause analysis
of OEE losses and countermeasure suggestions. Requirement: every production loss is visible and
actionable in real time. Electric drive assembly line, 10 stations, ideal cycle time 60 s, shift
06:00–14:00, plan 440 min (480 − 30 break − 10 autonomous maintenance), OEE target 85 %.

Data: data/oee.xlsx, sheets:
- Vyroba_hodiny (168 rows, one per shift hour): Hodina_ID, Datum, Hodina_zmeny, Plan_min, Prestoj_min,
  Chod_min, Vyrobene_ks, OK_ks, NOK_ks, Retesty_pocet, Mikrostop_s, Retest_cas_s, Spomalenie_s
- Prestoje (33): Kod_chyby, Hodina_ID, Zariadenie, Pricina, Cas_od, Cas_do, Trvanie_min, Popis_EN
- NOK_detail (112): Hodina_ID, Pricina, NOK_ks, Kod_chyby, Kategoria_chyby, Popis_EN
- Ciselnik_chyb (82 codes: Typ = Prestoj | Kvalita)
- Kontrola_zmien: daily totals for verification; the last row "MESIAC" is the monthly total, not a shift.

Formulas (always compute from sums, never average percentages):
Availability = Chod_min / Plan_min; Performance = Vyrobene_ks / Chod_min;
Quality = OK_ks / Vyrobene_ks; OEE = A × P × Q.
Losses in pieces: downtime = Prestoj_min; speed = Chod_min − Vyrobene_ks
(split into Mikrostop_s, Retest_cas_s, Spomalenie_s, all /60); scrap = NOK_ks.
Monthly check: 8251 produced, 8132 OK, 119 NOK, 410 min downtime, OEE 88.01 %.
Group downtime by Zariadenie and Kod_chyby, not by Kategoria_chyby (it is inaccurate).

Stack: backend/ — Python 3.11, FastAPI, pandas, SQLite, port 8000.
frontend/ — React, TypeScript, Vite, Tailwind, shadcn/ui, ECharts, Framer Motion, port 5173.
UI language: English. "Real time" is a simulator that replays the data at accelerated speed;
all endpoints see only data up to the current simulation moment (sim_time).

API contract:
GET  /api/stream     → SSE, event "state" on every sim_time change (body as in /api/state)
GET  /api/state      → { sim_time, shift: {date, hour, plan_min, run_min, downtime_min, produced,
                         ok, nok, availability, performance, quality, oee, target},
                         hours: [same for each past hour of the shift],
                         active_downtime: null | {code, device, description, since} }
GET  /api/history?from&to → [{date, availability, performance, quality, oee, downtime_min, nok}]
GET  /api/heatmap?metric=oee|performance|downtime → [{date, hour, value}]
GET  /api/losses?from&to  → [{type: downtime|microstop|retest|slowdown|nok, code, device,
                         description, loss_pcs, loss_pp, count,
                         fix: null | {action, method, owner_role}}]
GET  /api/events?date    → [{time, kind: stop|defect|speed, code, title, detail, value, unit,
                         active}]  events of that day (default: sim date) up to sim_time, newest
                         first; speed = one event per hour with microstops/slowdown
GET  /api/errors/{code}?from&to → {code, kind, description, device, count, minutes, loss_pcs,
                         loss_pp, pattern: [{weekday, hour, count}], occurrences: [{start,
                         minutes, pcs}], next_expected: null | datetime, fix: null | {action,
                         method, owner_role}, gain_pp, why: null | str}
GET  /api/upcoming?hours=48 → [{code, kind: stop, title, expected_at, confidence: high|medium|low,
                         risk_pcs, evidence, insight_id}]  stops expected after sim_time within
                         that many hours of shift time, sorted by expected_at
GET  /api/insights   → [{id, kind: recurring_stop|prediction|slow_hour|quality|anomaly, severity:
                         high|medium|low, title, evidence, code, loss_pcs, loss_pp, expected_at,
                         recommendation: {action, method, owner_role, expected_gain_pcs}}]
POST /api/whatif     ← {remove: [code or key], from, to}
                     → {oee_before, oee_after, gain_pcs, gain_pp}
POST /api/chat       ← {question, history?: [{role: user|assistant, text}], code?, role?}
                     → {answer, sources: [str], followups: [str]}  code = the error on screen,
                         role = the user's role; last 6 history turns are used; 503 without an
                         LLM key or when the LLM fails or times out (> 10 s), never 500
GET  /api/chat/suggestions?code&role → [str]  3-4 starter questions; 503 without an LLM key
                         (the app then hides "Ask AI")
GET  /api/report?date → {date, kpis, top_losses, insights, actions, summary}
GET/POST /api/actions, PATCH /api/actions/{id}
                     → {id, insight_id, title, owner, status: open|in_progress|done, created_at}
POST /api/sim/control ← {speed, jump_to, paused}
POST /api/upload     ← xlsx with the same structure; replaces the dataset

Working rules: do only what your task describes, stage by stage; do not add extra features,
configs or structure; do not touch other members' folders. After each stage, stop and show
the result. If the contract needs to change, stop and tell me.
