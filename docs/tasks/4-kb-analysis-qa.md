MEMBER 4 TASK. MY TASK — four parts, in order.
A (by hour 4). backend/insights/countermeasures.json. For each of the 82 codes in the
   Ciselnik_chyb sheet — an entry {action, method, owner_role}: action — a concrete countermeasure in one
   sentence; method — SMED | Poka-yoke | SPC | 5-Why | Autonomous maintenance | Standard work |
   Calibration | Preventive maintenance; owner_role — Maintenance | Quality | Logistics |
   Team leader | Process engineer. Most carefully — the codes present in the data: ST-038, ST-016, ST-046,
   ST-047, ST-001, ST-017, Q-020, Q-026, Q-030, Q-031. Add keys slow_hour_1 (slow shift
   start), slow_hour_5 (restart after break), microstop, retest. Guidance from the Magna
   materials: camera — cleaning and lighting check in autonomous maintenance; restart —
   line and material ready before the break ends; pressing — force and position monitoring
   with an SPC signal; screws — calibration at the start of the shift. Validate the JSON and all 82 codes.
B (hours 8–16). Pages in frontend/src/pages/analysis and frontend/src/pages/actions.
   Use only existing components from frontend/src/components/ and the theme tokens; do not
   introduce new colors or styles, do not change shared files.
   Analysis: daily OEE chart with a target line; "day × hour" heatmap with a metric
   switch (/api/heatmap); Pareto of causes with a downtime / scrap switch (/api/losses);
   period selection.
   Actions: a board with three columns open / in_progress / done, status change by drag and drop
   or a button; each card shows the owner, the linked insight and the expected gain in pieces.
C (hours 16–20). Open the app in the browser and run the scenario: jump to 2026-11-25 08:30
   → camera warning with a countdown → at 09:08 downtime banner and a dip on the
   chart → create an action → change its status → What if without ST-038 → Analysis. Compile a list of
   bugs with screenshots; do not change other members' code.
D (in parallel with C). docs/pitch.md, 5 minutes, 7 slides with speaker notes: problem; data
   (OEE 88.0 %, 1108 pcs lost: 52 % speed, 37 % downtime, 11 % scrap); what the engine found
   (all 4 shifts below target — Wednesdays because of ST-038; ST-047 every Thursday; slow hours 1 and 5);
   how the solution works; demo; impact (without the two recurring stops ≈ +1.7 pp OEE, levelling
   hours 1 and 5 ≈ +1.1 pp); next steps.
