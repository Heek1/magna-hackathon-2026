> **Update:** the visual design and the screens below are replaced by [the design brief](../design-brief.md) (mobile-first, Figma linked there). Where this task and the brief disagree, follow the brief.

MEMBER 3 TASK. MY TASK: frontend/ — scaffold, design system and the Live page. The Analysis
and Actions pages are built by another member on top of my components, so the components must be
reusable and live in frontend/src/components/.
Design: a factory control room, not a typical SaaS template. Dark theme: near-black background
with a cool tint, surfaces one tone lighter, thin borders instead of shadows. One accent
color — Magna red — only for things that require action. Statuses: green / amber /
red, always paired with an icon or text. Numbers in a monospace font with tabular
figures, large, readable from three meters; labels small, muted, uppercase.
Animation only when meaningful: smooth number changes, a new insight appearing, pulsing active downtime.
No gradients, glass or decorative illustrations.
Stage 1 (by hour 8), using mocks from frontend/src/mocks/:
1. Color and typography tokens in Tailwind, base components: KpiCard, Panel, StatusBadge,
   InsightCard, an ECharts chart wrapper in the project theme.
2. Scaffold: side navigation (Live, Analysis, Actions), header with simulation time, controls
   (pause, speed, jump to date and time) and a shift indicator.
3. Live page: four KPIs with deviation from target; active downtime banner with a timer;
   waterfall chart of losses in pieces (ideal → downtime → speed → scrap → good);
   hourly output vs 60 pcs/h with downtime markers; insight feed where
   prediction is pinned at the top with a countdown to expected_at, and each card has a
   "Create action" button.
Stage 2 (by hour 16): switch from mocks to /api/stream and the real endpoints; "What if" panel
(select causes → POST /api/whatif → animated OEE before vs after comparison);
chat panel (hidden if /api/chat returns 503); loading, empty and error states
for every block; check on a 1920×1080 projector screen.
Show the component structure and tokens first, then implement.
