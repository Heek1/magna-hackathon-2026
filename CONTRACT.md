КОНТЕКСТ ПРОЄКТУ (однаковий для всієї команди, контракт самостійно не змінюй)
Хакатон Magna, 24 години, завдання 5 "AI OEE Improvement Engine": автоматичний аналіз причин
втрат OEE і пропозиція контрзаходів. Вимога: кожна виробнича втрата видима і вирішувана
в реальному часі. Лінія складання електроприводу, 10 станцій, ідеальний цикл 60 с, зміна
06:00–14:00, план 440 хв (480 − 30 перерва − 10 автономне обслуговування), ціль OEE 85 %.

Дані: data/oee.xlsx, аркуші:
- Vyroba_hodiny (168 рядків, година зміни): Hodina_ID, Datum, Hodina_zmeny, Plan_min, Prestoj_min,
  Chod_min, Vyrobene_ks, OK_ks, NOK_ks, Retesty_pocet, Mikrostop_s, Retest_cas_s, Spomalenie_s
- Prestoje (33): Kod_chyby, Hodina_ID, Zariadenie, Pricina, Cas_od, Cas_do, Trvanie_min, Popis_EN
- NOK_detail (112): Hodina_ID, Pricina, NOK_ks, Kod_chyby, Kategoria_chyby, Popis_EN
- Ciselnik_chyb (82 коди: Typ = Prestoj | Kvalita)
- Kontrola_zmien: денні підсумки для перевірки; останній рядок "MESIAC" — підсумок, не зміна.

Формули (завжди із сум, ніколи не усереднюй відсотки):
Availability = Chod_min / Plan_min; Performance = Vyrobene_ks / Chod_min;
Quality = OK_ks / Vyrobene_ks; OEE = A × P × Q.
Втрати в штуках: простій = Prestoj_min; швидкість = Chod_min − Vyrobene_ks
(ділиться на Mikrostop_s, Retest_cas_s, Spomalenie_s, усе /60); брак = NOK_ks.
Контроль за місяць: 8251 вироблено, 8132 OK, 119 NOK, 410 хв простою, OEE 88,01 %.
Групуй простої за Zariadenie і Kod_chyby, а не за Kategoria_chyby (вона неточна).

Стек: backend/ — Python 3.11, FastAPI, pandas, SQLite, порт 8000.
frontend/ — React, TypeScript, Vite, Tailwind, shadcn/ui, ECharts, Framer Motion, порт 5173.
Мова інтерфейсу: англійська. "Реальний час" — симулятор, що програє дані з прискоренням;
усі ендпоінти бачать лише дані до поточного моменту симуляції (sim_time).

API-контракт:
GET  /api/stream     → SSE, подія "state" при кожній зміні sim_time (тіло як у /api/state)
GET  /api/state      → { sim_time, shift: {date, hour, plan_min, run_min, downtime_min, produced,
                         ok, nok, availability, performance, quality, oee, target},
                         hours: [те саме по кожній минулій годині зміни],
                         active_downtime: null | {code, device, description, since} }
GET  /api/history?from&to → [{date, availability, performance, quality, oee, downtime_min, nok}]
GET  /api/heatmap?metric=oee|performance|downtime → [{date, hour, value}]
GET  /api/losses?from&to  → [{type: downtime|microstop|retest|slowdown|nok, code, device,
                         description, loss_pcs, loss_pp, count}]
GET  /api/insights   → [{id, kind: recurring_stop|prediction|slow_hour|quality|anomaly, severity:
                         high|medium|low, title, evidence, code, loss_pcs, loss_pp, expected_at,
                         recommendation: {action, method, owner_role, expected_gain_pcs}}]
POST /api/whatif     ← {remove: [code або ключ], from, to}
                     → {oee_before, oee_after, gain_pcs, gain_pp}
POST /api/chat       ← {question} → {answer}; без ключа LLM повертає 503
GET  /api/report?date → {date, kpis, top_losses, insights, actions, summary}
GET/POST /api/actions, PATCH /api/actions/{id}
                     → {id, insight_id, title, owner, status: open|in_progress|done, created_at}
POST /api/sim/control ← {speed, jump_to, paused}
POST /api/upload     ← xlsx тієї ж структури; замінює набір даних

Правила роботи: роби лише те, що описано у твоєму завданні, по етапах; не додавай зайвих
функцій, конфігів чи структури; не чіпай чужі папки. Після кожного етапу зупинись і покажи
результат. Якщо контракт треба змінити — зупинись і скажи мені.
