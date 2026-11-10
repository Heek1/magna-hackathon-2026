ЗАВДАННЯ УЧАСНИКА 1. МОЄ ЗАВДАННЯ backend/ (усе, крім backend/insights/).
Етап 1 (до 6-ї години):
1. Завантажувач xlsx у pandas з відсіюванням рядка "MESIAC" і перевіркою структури аркушів.
2. Модуль розрахунку OEE і втрат для довільного діапазону. Тест: кожна зміна збігається
   з Kontrola_zmien, місячні підсумки — з контрольними числами.
3. Симулятор: sim_time, швидкість, пауза, стрибок. Поточна неповна година віддається
   пропорційно до минулих хвилин; простій стає active_downtime між Cas_od і Cas_do.
4. Ендпоінти /api/state, /api/stream (SSE), /api/history, /api/heatmap, /api/losses,
   /api/sim/control, CRUD /api/actions у SQLite. CORS для порту 5173.
5. /api/insights, /api/whatif, /api/chat викликають функції з backend/insights/
   (get_insights, what_if, chat), які пише інший учасник; до їх появи — заглушки
   з правильною формою відповіді.
6. Збережи приклад відповіді кожного ендпоінта у frontend/src/mocks/*.json.
Етап 2 (до 16-ї години): /api/report, /api/upload, docker-compose.yml для backend і frontend,
README з командою запуску.
Спершу покажи план файлів, потім реалізуй.
