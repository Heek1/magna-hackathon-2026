# Design brief: mobile-first redesign

This brief replaces the visual direction in the stage 2 parts of tasks 3 and 4. It comes from the
organizers' feedback: the app must be simple, clear and open on a phone. A user must see at a
glance **which errors happen at which moment**, **which errors cost the most**, and **what the fix
is** — the most expensive errors are fixed first.

**Figma (source of truth):** https://www.figma.com/design/xEYQUqdSqoh95WvQYqrglO
Page "Mobile app": screens `01 Now`, `02 Top errors`, `03 Error detail` and a `Components` board.
Open the frames and copy sizes, colors and spacing from Figma's Inspect panel; do not eyeball them.

## Principles

1. **One screen, one question.** Now — what is happening and when. Top errors — what to fix
   first. Error detail — when it happens and how to fix it.
2. **Mobile first.** Design for 390 × 844. On wider screens the same components are laid out in
   columns (see "Desktop and projector").
3. **Light premium look.** Light grey canvas, white cards with a soft shadow, one dark hero card
   for the live line status. Color only for meaning: red = stop, amber = defect, blue = speed,
   green = fix.
4. **Every error comes with its fix.** No error card without the countermeasure next to it.
5. **Numbers are the heroes.** Large mono numbers, small muted labels.

## Tokens

Replace the dark theme in `frontend/src/theme/tokens.ts` with these values (names match the Figma
variables).

| Token | Value | Use |
|---|---|---|
| `bg/canvas` | `#F3F4F7` | page background |
| `bg/card` | `#FFFFFF` | cards, tab bar |
| `bg/subtle` | `#F6F7F9` | empty cells, progress tracks, rank badge |
| `bg/ink` | `#0E1116` | hero status card, primary buttons |
| `text/primary` | `#0B0D12` | titles, numbers |
| `text/secondary` | `#5F6672` | supporting text |
| `text/tertiary` | `#9AA1AD` | labels, times, inactive tabs |
| `border/default` | `#E6E8EC` | dividers |
| `status/stop` · `-bg` | `#E5243B` · `#FDECEE` | downtime, line stopped, #1 to fix |
| `status/defect` · `-bg` | `#F08A00` · `#FFF4E5` | scrap / quality |
| `status/speed` · `-bg` | `#2F6BFF` · `#EAF0FF` | microstops, slowdown, retests |
| `status/fix` · `-bg` | `#0E9F6E` · `#E7F6EF` | solutions, gains |

- **Fonts:** Geist (UI) and Geist Mono (numbers), from `@fontsource/geist-sans` and
  `@fontsource/geist-mono`. Remove IBM Plex.
- **Type scale:** Display 34/40 Bold · Title L 22/28 SemiBold · Title M 17/22 SemiBold ·
  Body 15/20 Medium or Regular · Caption 13/18 · Overline 11/14 SemiBold uppercase +6 % tracking ·
  Number Hero 44/48 · Number L 28/32 · Number M 17/22 · Number S 13/16 (all Geist Mono SemiBold
  or Medium).
- **Radius:** cards 22, hero card 26, chips 999, buttons 18, small badges 9–12.
- **Shadow (`Elevation/Card`):** `0 1px 2px rgba(16,24,40,.04), 0 8px 24px -4px rgba(16,24,40,.06)`.
- **Spacing:** 16 px page gutter, 12–14 px between cards, 16–18 px card padding.

## Components (`frontend/src/components/`)

| Component | What it is |
|---|---|
| `Card` | white card, radius 22, card shadow; replaces `Panel` |
| `Chip` | pill with dot + label; tones `stop`, `defect`, `speed`, `fix`, `neutral` |
| `EventRow` | time (mono) · tinted icon square · title + subtitle · value in tone color |
| `RankRow` | rank badge · title + meta · value + "pcs lost" · progress bar scaled to #1 |
| `StatusHero` | dark card: "LINE STOPPED" pill, error name, live timer, recommended fix row; a calm "Running" variant when there is no active downtime |
| `OeeRing` | small ring (48 px) + OEE value + delta to target in pp |
| `PatternGrid` | weekday × hour grid (Mon–Fri × 06–13); hot cells in tone color |
| `SegmentedControl` | Stops / Defects / Speed |
| `TabBar` | bottom tabs: Now, Top errors, Fixes; hidden on the detail screen |
| `BottomBar` | sticky primary button (used on the detail screen) |

Keep `AnimatedNumber` (timer, numbers) and `Countdown`. ECharts is no longer needed for these
three screens; keep it only if the desktop view uses it.

## Screens

### 01 Now — `frontend/src/pages/live` (member 3)

- Header: overline `LINE L01 · WED 25 NOV`, greeting title, "Live" pill.
- `StatusHero` from `/api/state.active_downtime` (timer counts from `since`); fix text from
  the matching countermeasure. With no downtime: green "Running" variant with the shift OEE.
- Two KPI cards: `OeeRing` (shift OEE vs 85 %) and "Lost today" in pieces (ideal − good).
- "Errors today": `EventRow` list from `GET /api/events`, newest first. Tap → Error detail.

### 02 Top errors — `frontend/src/pages/analysis` (member 1)

- Overline `NOVEMBER · BY PIECES LOST`, title "Top errors".
- `SegmentedControl`: Stops = `type downtime`, Defects = `nok`, Speed = `microstop|retest|slowdown`.
- #1 item as the "Fix first" card: red badge, pattern chip (e.g. "Every Wed 09:08"), big loss
  number, green solution block, owner chip, gain chip, "Assign" button (creates an action).
- "Next to fix": the rest as `RankRow`, bar width = loss / loss of #1. Tap → Error detail.
- Data: `GET /api/losses` (with the new `fix` field) for the selected period.

### 03 Error detail — `frontend/src/pages/analysis/ErrorDetail` (member 1)

- Back button, tone chip, code as the title, description below.
- Three stat cards: times, minutes stopped (or pieces scrapped for defects), pieces lost.
- "When it happens": `PatternGrid` + red note with the pattern and the next expected time.
- Solution card: gain chip, numbered steps (split `fix.action` into steps, or show it as one).
- Sticky `BottomBar`: "Create action for {owner_role}" → `POST /api/actions`.
- Data: `GET /api/errors/{code}`.

### Fixes — `frontend/src/pages/actions` (member 1)

The existing board as a single list on phones: segmented Open / In progress / Done, cards with
owner, linked error and expected gain. Three columns stay on desktop.

## Desktop and projector

Same components, no separate design. At ≥ 1024 px: left nav instead of the tab bar; Now and Top
errors side by side; Error detail opens as a right-hand panel. Check at 390 × 844 first, then
1920 × 1080.

## App on the phone (PWA)

Add `vite-plugin-pwa` with a manifest (name "OEE Engine", theme `#F3F4F7`, 192/512 icons) so the
site can be installed to the home screen and opens full-screen. No native app.

## Who does what

| Member | Work |
|---|---|
| 1 · backend + screens | new endpoints (done); Top errors, Error detail and Fixes screens using only the shared components and tokens; QA run on a phone and at 1920×1080 |
| 2 · insights | no UI change; the Now hero and detail pattern can reuse `recurring_stop` / `prediction` insights |
| 3 · frontend | tokens, fonts, components above, app shell (tab bar / desktop nav), Now screen, PWA, real API instead of mocks |
| 4 · knowledge base, pitch | translate `docs/pitch.md` to English and update its demo slide to the mobile app |

Order: member 3 ships tokens and components first (they block member 1's screens).
