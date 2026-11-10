MEMBER 1 TASK. MY TASK: backend/ (everything except backend/insights/).
Stage 1 (by hour 6):
1. xlsx loader into pandas that filters out the "MESIAC" row and validates the sheet structure.
2. OEE and loss calculation module for an arbitrary range. Test: every shift matches
   Kontrola_zmien, monthly totals match the control numbers.
3. Simulator: sim_time, speed, pause, jump. The current incomplete hour is returned
   proportionally to the elapsed minutes; a downtime becomes active_downtime between Cas_od and Cas_do.
4. Endpoints /api/state, /api/stream (SSE), /api/history, /api/heatmap, /api/losses,
   /api/sim/control, CRUD /api/actions in SQLite. CORS for port 5173.
5. /api/insights, /api/whatif, /api/chat call functions from backend/insights/
   (get_insights, what_if, chat), written by another member; until they exist — stubs
   with the correct response shape.
6. Save a sample response of every endpoint to frontend/src/mocks/*.json.
Stage 2 (by hour 16): /api/report, /api/upload, docker-compose.yml for backend and frontend,
README with the run command.
Show the file plan first, then implement.
