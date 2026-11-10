# Magna Hackathon 2026 — AI OEE Improvement Engine

Завдання 5: автоматичний аналіз причин втрат OEE і пропозиція контрзаходів.
Спільний контекст, формули й API — у [CONTRACT.md](CONTRACT.md). Дані — `data/oee.xlsx`.

## Команда і зони відповідальності

| Учасник | Гілка | Папки, які належать учаснику | Завдання |
|---|---|---|---|
| 1 — Backend core | `feat/backend-core` | `backend/` (крім `backend/insights/`) | [docs/tasks/1-backend-core.md](docs/tasks/1-backend-core.md) |
| 2 — Insights | `feat/insights` | `backend/insights/` (крім `countermeasures.json`) | [docs/tasks/2-insights.md](docs/tasks/2-insights.md) |
| 3 — Frontend + Live | `feat/frontend-live` | `frontend/` (крім `src/pages/analysis` і `src/pages/actions`) | [docs/tasks/3-frontend-live.md](docs/tasks/3-frontend-live.md) |
| 4 — KB, Analysis, QA | `feat/kb-analysis-qa` | `backend/insights/countermeasures.json`, `frontend/src/pages/analysis`, `frontend/src/pages/actions`, `docs/pitch.md` | [docs/tasks/4-kb-analysis-qa.md](docs/tasks/4-kb-analysis-qa.md) |

## Правила

- У `main` ніхто не пушить напряму — лише тімлід зливає pull request.
- Кожен змінює **тільки свої папки** (див. таблицю).
- Коміти малі й часті; пуш щонайменше раз на годину.
- Зміни `CONTRACT.md` — лише через тімліда.
- Перед кожною точкою інтеграції зроби rebase на `main`:
  `git fetch origin && git rebase origin/main`, потім `git push --force-with-lease`.

## Точки інтеграції

| Година | Подія |
|---|---|
| 8-ма | Інтеграція 1: моки → реальні ендпоінти, перші інсайти |
| 16-та | Інтеграція 2: усі функції етапу 2 |
| 20-та | **Заморозка функцій** — далі лише виправлення помилок і пітч |

## Старт

```bash
git clone https://github.com/Heek1/magna-oee-engine.git
cd magna-oee-engine
git checkout <твоя-гілка>
```
