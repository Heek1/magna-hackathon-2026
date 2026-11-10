MEMBER 2 TASK. MY TASK: backend/insights/. The input of every function is three DataFrames (hours, downtime, scrap),
trimmed to sim_time.
Stage 1 (by hour 8): get_insights(data) -> list[dict] in the /api/insights format. Detectors
based on rules and statistics, no external services:
1. recurring_stop: a downtime code that repeats on the same weekday and shift hour
   (in the data: ST-038 every Wednesday at 09:08 for 25 min; ST-047 every Thursday at 08:08 for 15 min).
2. prediction: if today's weekday has a recurring downtime that has not happened yet —
   a warning with expected_at and the expected loss. Once the event occurs, the insight disappears.
3. slow_hour: shift hours with consistently lower Performance (in the data: hour 1 88.5 %,
   hour 5 86.9 % vs ~94.5 % for the others).
4. quality: Pareto of scrap codes and a spike of a code relative to its average.
5. anomaly: the current hour where OEE or microstops deviate from that hour's norm
   by more than 2 standard deviations.
Every insight: loss_pcs, loss_pp, evidence with concrete numbers and dates, sorted by
loss_pcs. recommendation — from backend/insights/countermeasures.json by key code or kind
(the file is prepared by another member, format {key: {action, method, owner_role}}); no key — null.
Test: on the full data, ST-038, ST-047 and slow hours 1 and 5 are found.
Stage 2 (by hour 16):
6. what_if(data, remove, from, to): removed downtime minutes become run time with the actual
   Performance and Quality of the period; keys slow_hour_1 and slow_hour_5 raise the hour's
   Performance to the median of the other hours. Returns oee_before, oee_after, gain_pcs, gain_pp.
7. chat(question, data): if GEMINI_API_KEY is set, answers via an LLM, passing it a compact
   data snapshot (KPIs, losses, insights) and an instruction to answer only based on it;
   without the key, raises an exception that the API converts to 503.
