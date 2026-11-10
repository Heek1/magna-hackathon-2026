# AI OEE Improvement Engine — Magna Hackathon 2026
## Pitch Deck: 5 Minutes, 7 Slides with Speaker Notes

---

### Slide 1. The Problem: Why 88% OEE Hides Millions in Lost Output
**Headline**: Moving from reactive firefighting to proactive, real-time OEE loss prevention.

* **Context**:
  * Magna electric drive assembly line (10 stations, 60 s ideal cycle, single shift 06:00–14:00).
  * On paper, monthly OEE is **88.0%**, beating the corporate target of **85.0%**.
  * **The reality**: across 21 shifts, the line lost **1,108 electric drives**!
* **Critical Operational Challenges**:
  1. **Invisible losses**: Equipment microstops, sluggish shift startups, and post-break ramp-ups are never logged in standard downtime sheets.
  2. **Reactive response**: Quality defects and recurring breakdowns are discovered after the shift is already compromised.
  3. **Analysis-action disconnect**: Engineers spend hours in Excel spreadsheets instead of executing standardized countermeasures on the line.
* **Magna Hackathon Mandate**:
  > *Every manufacturing loss must be visible and actionable in real time.*

> 🎙️ **Speaker Notes (00:00 – 00:45)**:
> "Good morning, judges and Magna colleagues. Take a look at this headline number: 88% OEE. At first glance, the line seems to perform well — after all, the 85% target is met. But in automotive manufacturing, the devil is in the details. Behind that three percent buffer lie more than 1,100 unbuilt electric drives in just one month on a single shift.
> Today, plant supervisors and process engineers discover root causes only after the shift is over, or after a station has stood idle for thirty minutes. Our mission is to turn OEE from a backward-looking report into a live operating system: every lost second is instantly surfaced, explained, and paired with a proven countermeasure before it damages shift throughput."

---

### Slide 2. Anatomy of Losses: Where Did 1,108 Electric Drives Go?
**Headline**: 8,251 produced, 1,108 lost — the true breakdown of line deficit.

* **Monthly Baseline (21 shifts, 9,240 planned minutes)**:
  * Planned potential: **9,359 pcs** | Actual production: **8,251 pcs** (8,132 OK, 119 NOK).
  * Total lost capacity: **1,108 pcs**.
* **Three Loss Pillars (Contract Formulas)**:
  1. ⚡ **Speed Loss (Performance) — 52% (579 pcs lost)**:
     * The largest hidden efficiency killer.
     * 19,621 s — line cycle slowdowns;
     * 11,999 s — equipment microstops;
     * 3,120 s — retests.
  2. 🛑 **Downtime Loss (Availability) — 37% (410 pcs / 410 min lost)**:
     * 33 logged breakdown events across 10 stations.
  3. ⚠️ **Quality Loss (Scrap / NOK) — 11% (119 pcs lost)**:
     * 112 defect entries (fluid leakage, press-fit stroke, torque joint).

| OEE Factor | Actual | Magna Target | Loss in Pieces | Share of Total Loss |
| :--- | :---: | :---: | :---: | :---: |
| **Performance (Speed)** | 93.4% | 95.0% | **579 pcs** | **52.2%** |
| **Availability (Downtime)** | 95.6% | 96.0% | **410 pcs** | **37.0%** |
| **Quality (Scrap)** | 98.6% | 99.0% | **119 pcs** | **10.8%** |
| **OEE (Overall)** | **88.0%** | **85.0%** | **1,108 pcs** | **100.0%** |

*Core Rule: Metrics are calculated strictly from raw sums, never by averaging percentages.*

> 🎙️ **Speaker Notes (00:45 – 01:30)**:
> "Where did those 1,108 electric drives vanish? Over half of all losses — 52% — were speed losses: silent microstops and cycle slowdowns totaling 579 pieces. Downtime accounts for 37%, or 410 lost pieces across 33 logged breakdowns. Quality scrap accounts for the remaining 11%, or 119 defective parts.
> Note that we strictly compute availability, performance, and quality from raw sums rather than averaging percentages. When we group downtime by station and error code instead of unreliable categories, systematic operational patterns immediately stand out."

---

### Slide 3. What the Engine Uncovered: Systematic Patterns Hiding in Plain Sight
**Headline**: Every target miss was predictable — recurring stops and sluggish shift hours.

* **Finding 1: Wednesday Camera Failure (`ST-038`)**:
  * All 4 shifts that missed the 85% target were Wednesdays (Nov 4, 11, 18, 25).
  * Exact cause: Station `Kamera`, error `ST-038` (camera light module interrupted operation).
  * Recurring weekly pattern: exactly at **09:08**, lasting **25 minutes**, costing **100 lost pieces** over the month.
* **Finding 2: Thursday Leak Test Failure (`ST-047`)**:
  * Every Thursday (Nov 5, 12, 19, 26) at **08:08**, Station `Leak test` suffers error `ST-047` (air leakage in test nest).
  * Exactly **15 minutes** downtime each week = **60 lost pieces**.
* **Finding 3: Sluggish Shift Kickoff & Post-Break Ramp-up (Hours 1 and 5)**:
  * **Hour 1 (06:00–07:00)**: Performance drops to **88.5%** vs the 94.6% shift median on all 21 shifts (microstops and slow line startup).
  * **Hour 5 (10:00–11:00)**: Performance drops to **86.9%** immediately after the 30-minute break.
* **Finding 4: Top Scrap Pareto (`Q-031`, `Q-020`, `Q-026`)**:
  * 3 defect codes generate **79% of all scrap**: fluid circuit leaks (`Q-031`), press-fit stroke shorts (`Q-020`), and screwdriver torque deficits (`Q-026`).

> 🎙️ **Speaker Notes (01:30 – 02:15)**:
> "Our analytics engine detected four clear operational anomalies.
> First: all four shifts that failed the 85% target occurred on Wednesdays. Why? Every single Wednesday at exactly 09:08, the inspection camera lighting failed for 25 minutes.
> Second: every Thursday at 08:08, the leak tester nest seal failed for 15 minutes.
> Third: hours 1 and 5 lag behind every single day. Shift kickoff in hour 1 drops performance to 88.5%, and restarting after lunch in hour 5 drops it to 86.9%.
> And in quality, just three defect codes cause 79% of all scrap. None of this is random bad luck — these are recurring, solvable engineering problems."

---

### Slide 4. The Solution Architecture: Real-Time Intelligence & Proven Countermeasures
**Headline**: A full-stack AI engine connecting real-time telemetry to Lean shopfloor execution.

* **Telemetry & Streaming Layer (FastAPI, SQLite, SSE)**:
  * High-speed simulator plays line data forward with adjustable acceleration (`/api/sim/control`).
  * Server-Sent Events (`/api/stream`) push instant state updates with zero polling delay.
  * Real-time endpoints enforce strict time travel: supervisors only see data up to current `sim_time`.
* **Automated Root-Cause Knowledge Base (82 Error Codes + 4 System Patterns)**:
  * Every single error code in `Ciselnik_chyb` is mapped to `{action, method, owner_role}`:
    * `ST-038` (Camera light) → Clean optics and verify lighting intensity during **Autonomous maintenance** (Owner: **Maintenance**).
    * `ST-047` (Leak test nest) → Scheduled seal replacement under **Preventive maintenance** (Owner: **Maintenance**).
    * `slow_hour_1` & `slow_hour_5` → Buffer staging & 5-minute pre-break line readiness under **Standard work** (Owner: **Team leader**).
    * `Q-020` (Press-fit) → Dynamic force-distance envelope with **SPC** alarming (Owner: **Process engineer**).
    * `Q-026` (Torque joints) → Shift-start electric screwdriver **Calibration** (Owner: **Maintenance**).
* **Predictive & What-If Simulation Engine**:
  * Predicts recurring stops before they hit and displays a live countdown.
  * Instant What-If modeling (`POST /api/whatif`): recalculates monthly OEE and piece gains if selected failure modes are eliminated.

> 🎙️ **Speaker Notes (02:15 – 03:00)**:
> "To solve this, we built a real-time AI OEE Improvement Engine. The backend streams live line states over Server-Sent Events with sub-second latency.
> What makes our engine unique is its manufacturing DNA: we mapped all 82 error codes and line bottlenecks to concrete Lean countermeasures. When the camera light fails, the system does not just print an alert — it assigns an Autonomous Maintenance check of light intensity to Maintenance. When press-fitting drifts, it triggers an SPC alarm for the Process Engineer.
> And with our What-If simulator, plant managers can instantly test countermeasure impacts on monthly OEE before spending a single dollar."

---

### Slide 5. Live Product Walkthrough: Built for the Shopfloor Phone
**Headline**: Mobile-first design for operators and team leaders — every error paired with its fix.

* **Designed for the Shopfloor (390 × 844 Mobile-First, PWA)**:
  * Installs directly to any smartphone home screen as a standalone Progressive Web App (PWA).
  * Clean responsive design: single-column workflow on phones, expanding to multi-column dashboards on overhead monitors.
* **Step-by-Step Incident Lifecycle Walkthrough**:
  1. **01 Now Screen (`/`)**:
     * Live shift OEE ring gauge vs 85% target and pieces lost today.
     * When downtime strikes, a dark **StatusHero** card turns red: live elapsed timer, error code `ST-038`, and countermeasure preview.
     * Chronological "Errors today" feed from `/api/events`.
  2. **02 Top Errors Screen (`/analysis`)**:
     * Segmented tabs for **Stops**, **Defects**, and **Speed losses** ranked by pieces lost.
     * **#1 "Fix First" Hero Card**: highlights `ST-038` — 87 pcs lost so far this month (Nov 25, 09:20; 100 pcs over the full month), recurring pattern chip (*Every Wed 09:08*), green solution block, and one-tap **Assign** button.
     * **Next to Fix List**: relative progress bars showing loss scale for immediate triage.
  3. **03 Error Detail Screen (`/analysis` subview)**:
     * Three KPI cards: frequency, downtime minutes, and lost pieces.
     * **PatternGrid (Mon–Fri × 06–13h)**: visualizes when the error occurs and alerts: *Next expected: Wed 2 Dec, 09:08*.
     * Actionable numbered steps for technicians.
     * Sticky bottom bar: **Create Action for Maintenance**.
  4. **Fixes Screen (`/actions`)**:
     * Mobile segmented view: **Open**, **In Progress**, **Done**.
     * Desktop 3-column Kanban board: tracks assignees, linked error codes, and verified piece gains.

> 🎙️ **Speaker Notes (03:00 – 04:00)**:
> "Let us walk through the user experience on a smartphone. The interface is mobile-first, installs like an app on any operator's phone, and scales cleanly to plant monitors.
> On the Now screen, operators immediately see the active line status. When Station Kamera trips on error ST-038, the hero card turns red, starts a live downtime timer, and surfaces the fix.
> Swiping to Top Errors reveals our Fix First card: ST-038 leads with 87 pieces lost so far this month as of November 25, and 100 pieces over the full month. Tapping into Error Detail displays our PatternGrid: the supervisor sees that this stop strikes every Wednesday at 09:08, with the next occurrence countdown already ticking.
> With a single tap on the sticky button, the supervisor assigns a standardized action to Maintenance. The task moves straight to the Action Board, closing the loop from incident detection to resolution."

---

### Slide 6. Business Impact & ROI: Turning Data into Delivered Output
**Headline**: +2.74 percentage points in OEE = 253 additional good electric drives every month.

* **Validated Impact (Based on Full Month Model & What-If Simulation)**:
  1. **Eliminate Two Chronic Weekly Stops (`ST-038` + `ST-047`)**:
     * Camera cleaning in autonomous maintenance + preventive leak test nest seal replacement.
     * **Direct Gain: +1.59 percentage points OEE (+147 good pcs / month)**.
     * *Breakdown: `ST-038` alone = +1.00 pp (+92 good pcs); `ST-047` alone = +0.60 pp (+55 good pcs).*
  2. **Level Shift Kickoff & Post-Break Ramp-up (Hours 1 and 5)**:
     * Pre-shift autonomous maintenance staging + 5-minute pre-break parts replenishment by logistics.
     * **Direct Gain: +1.14 percentage points OEE (+105 good pcs / month)**.
     * *Breakdown: Hour 1 lift = +59 good pcs; Hour 5 lift = +46 good pcs.*
  3. **All Four Countermeasures Combined**:
     * Eliminating both chronic stops and leveling hours 1 and 5 simultaneously.
     * **Combined Gain: +2.74 percentage points OEE (+253 good pcs / month)**.
* **Total Operational Value**:
  * OEE growth: **from 88.0% to 90.8%** (+2.74 percentage points).
  * Net production gain: **+253 good electric drives per month** on a single assembly line.
  * Payback period: **Immediate** (zero capital expenditure — operational standardization and existing staff).

> 🎙️ **Speaker Notes (04:00 – 04:35)**:
> "Let us examine the business return for Magna. Every number here is derived strictly from our validated mathematical model on the full month of data.
> Eliminating just two chronic weekly stops — the camera lighting and leak test nest — delivers a 1.59 percentage point increase in monthly OEE, recovering 147 good electric drives.
> Leveling the startup efficiency of hours 1 and 5 adds another 1.14 percentage points, or 105 good drives.
> Implementing all four countermeasures together raises line OEE from 88.0% to 90.8%. That is 253 high-margin electric drive units recovered every month on a single line, with zero capital expenditure on new machinery."

---

### Slide 7. Implementation Roadmap & Next Steps
**Headline**: Scaling the AI OEE Improvement Engine across Magna manufacturing plants.

* **Phase 1 (Month 1): Factory Floor Pilot**:
  * Connect backend directly to industrial PLC controllers (Siemens / Beckhoff via OPC-UA and MQTT) replacing the simulator.
  * Deploy the PWA app to team leader tablets and 65-inch overhead station displays.
* **Phase 2 (Months 2–3): AI Operator Copilot & Automated Reporting**:
  * Integrate Google Gemini LLM API with our countermeasures knowledge base for instant natural language Q&A: *"Why did cycle time drop on station 4?"*.
  * Automated shift change handover reports generated via `/api/report`.
* **Phase 3 (Months 4–6): Multi-Line Enterprise Rollout**:
  * Scale the engine across all 10 assembly lines and integrate with Magna's corporate MES/ERP systems.

> 🎙️ **Speaker Notes (04:35 – 05:00)**:
> "What are the next steps? Our architecture is containerized, modular, and ready for deployment.
> Next week, we can connect live OPC-UA feeds directly from station PLCs. Next month, our LLM copilot will allow technicians to ask natural language questions right from the line.
> The AI OEE Improvement Engine is not just a hackathon prototype — it is a production-ready operational tool that makes every manufacturing loss visible, predictable, and solvable in real time.
> Thank you, and we welcome your questions."
