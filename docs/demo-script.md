# Ghost Protocol — 3-Minute Demo Script (CASE-001)

> **Context & Rules:**
> - Single source of truth: [docs/demo-scenario.md](file:///home/gamp/Ghost-Protocol/docs/demo-scenario.md).
> - All incident data is fictional. No real people, organizations, or events.
> - Preserves product rules: never state who is responsible, never collapse uncertainty, never overwrite source timestamps.
> - Script duration: Exactly 180 seconds (3:00).
> - Every live action includes a spoken line, screen action, timing cue, and fallback line.

---

## 1. Setup & Pre-Flight Checklist (T-5 minutes)

Before starting the demo recording or live presentation, execute this sequence:

```bash
# 1. Reset backend store to the clean seeded state
curl -s -X POST http://localhost:8000/api/demo/reset | jq .

# 2. Verify backend status and CASE-001 integrity
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:8000/api/cases/CASE-001 | jq .evidence_count # must output 6

# 3. Verify staged item E-07 is ready
curl -s http://localhost:8000/api/cases/CASE-001/staged | jq .[0].evidence_id # must output "E-07"
```

1. **Browser state:** Open Chrome at `http://localhost:3000/dashboard` in full-screen (100% zoom, 1920×1080 recommended).
2. **Tab preparation:** Keep a second tab pinned to `http://localhost:8000/docs` (FastAPI Swagger UI) in case backend inspection is requested.
3. **Terminal preparation:** Keep a clean bash terminal open in the background with the curl fallback commands pre-typed.

---

## 2. Second-by-Second Demo Script

### 0:00 – 0:20 | The Problem (Scene Setting)

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:10** | "In any incident investigation—whether a warehouse loss, an industrial outage, or a physical breach—evidence arrives in fragments: CCTV video, badge access logs, panel audio, inventory spreadsheets, and witness statements." | Camera on presenter / screen shows **Ghost Protocol Workstation Dashboard** (`/dashboard`). Mouse rests over the top metric cards. | *If the page is slow or blank:* "Let's reload the workstation dashboard—our frontend talks directly to the local FastAPI evidence engine." |
| **0:10 – 0:20** | "Investigators cross-reference these manually. Clocks drift by minutes, copied logs masquerade as independent records, and once summarized, the uncertainty disappears. Ghost Protocol turns fragmented evidence into a verifiable timeline without flattening uncertainty or accusing anyone." | Presenter hovers over metric cards: **01 Active cases**, **06 Evidence items**, **04 Open conflicts**, **02 Unresolved claims**. | *If metrics do not display:* "The dashboard aggregates our real-time audit graph, tracking our six ingested items and open conflicts." |

---

### 0:20 – 0:45 | Open CASE-001 (Incident Context)

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **0:20 – 0:32** | "Here is `CASE-001`: a warehouse incident on October 10th, 2026. Asset `EQ-4471` was recorded secured at 21:00 and discovered missing at 22:00. Six evidence items were collected across video, audio, CSV logs, and a witness PDF." | Move cursor to **Recent cases** list. Click on the row: `CASE-001 · Warehouse equipment incident`. | *If row click fails:* Click **Timeline** in the left sidebar navigation (`/cases/CASE-001/timeline`). |
| **0:32 – 0:45** | "Notice our core principle right on the dashboard: we never label anyone as guilty, and provenance is cryptographically locked via SHA-256 hashing at ingestion. Let's step directly into the reconstructed timeline." | Workstation navigates to `/cases/CASE-001/timeline`. The chronological event stream renders with state badges (Lime, Coral, Blue, Gold). | *If timeline navigation stalls:* Type `http://localhost:3000/cases/CASE-001/timeline` directly into the browser URL bar. |

---

### 0:45 – 1:10 | Timeline: Source Time vs. Normalized Time

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **0:45 – 0:58** | "Look at how Ghost Protocol displays time. Traditional tools overwrite timestamps to make events line up. We never do that. Original source data is immutable. Every event displays its normalized time alongside its original source time and the exact rule applied." | Scroll down the timeline. Highlight event **EV-014** (Loading-bay CCTV, item `E-02`, locator `timecode 00:39`). | *If layout wraps unexpectedly:* "Notice the dual time indicators on EV-014: normalized time on the left, source time on the right." |
| **0:58 – 1:10** | "On `EV-014`, the camera records a trolley moving through the bay at source time `21:16:00`. But our engine detected and applied a negative 120-second offset, placing it at normalized time `21:14:00`. Notice `EV-018` below it: the witness statement is stamped `~21:18` with an approximate ±2 minute uncertainty window." | Hover over the offset badge: `source 21:16:00 (−2 min)`. Then point cursor to `EV-018` with the `~21:18` badge and `Unresolved` state. | *If mouse hover tooltip does not show:* "As you can see in the text, source time 21:16:00 is explicitly linked to normalized 21:14:00, preserving the provenance trail." |

---

### 1:10 – 1:35 | C-02: Camera Clock Offset Rule

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **1:10 – 1:22** | "How did the engine know to adjust that clock? Let's open the Conflict Inspector. Ghost Protocol runs deterministic rules—no black-box AI hallucinations. Here is `C-02`, triggered by rule `RULE-TIME-001`." | Click **Conflicts** in the sidebar navigation (`/cases/CASE-001/conflicts`). Click on conflict **C-02** in the left panel list. | *If conflict item does not focus:* Navigate directly to `/cases/CASE-001/conflicts?c=C-02`. |
| **1:22 – 1:35** | "The loading-bay camera `E-02` runs 120 seconds fast relative to our NTP-synced reference sources `E-01` and `E-04`. Notice the system's honesty: it explicitly notes that this offset was declared in the fixture metadata, clearly stating what is known and what remains an assumption." | Presenter highlights the explanation card for `C-02`, pointing out `RULE-TIME-001` and the fact sheet showing `E-02` against `E-01` and `E-04`. | *If conflict details are slow to expand:* "The conflict card details the exact evidence items compared: E-02 against reference clocks E-01 and E-04." |

---

### 1:35 – 1:55 | C-01: Copied Log Record (RULE-DUP-001)

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **1:35 – 1:47** | "Now let's examine our highest-severity flag: `C-01`, detected by `RULE-DUP-001`. The inventory log `E-05` row 7 records a door event at `21:09:00`. But it is an exact duplicate of access log `E-04` row 18 on badge `B-117` and door ID." | Click on conflict **C-01** in the Open Conflicts menu. The inspection table compares original (`E-04 r18`) and duplicate (`E-05 r7`). | *If C-01 does not load:* Navigate to `/cases/CASE-001/conflicts?c=C-01`. |
| **1:47 – 1:55** | "Crucially, `21:09:00` is one minute before anyone even enters the outer perimeter at `21:10:00` on `E-01`. Ghost Protocol flags this as an investigative review prompt—never as an accusation of tampering or guilt." | Point to the table rows comparing `21:12:00` (E-04) and `21:09:00` (E-05). Highlight the review status tag: `Requires human review`. | *If table row highlight misses:* "Notice row 7 in E-05 timestamps a door event before entrance CCTV E-01 shows anyone on site." |

---

### 1:55 – 2:15 | Hypotheses: Comparing Without Collapsing

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **1:55 – 2:05** | "Instead of forcing a single verdict, Ghost Protocol generates competing hypotheses. Clicking 'Compare hypotheses' brings us to the three rival explanations for `C-01`." | Click **Compare hypotheses →** link at the bottom of the `C-01` inspector card (or **Hypotheses** in sidebar). | *If link does not navigate:* Click **Hypotheses** in sidebar (`/cases/CASE-001/hypotheses?c=C-01`). |
| **2:05 – 2:15** | "Explanation `H-01`: an automated database import artifact—marked **Inferred**. `H-02`: manual edit after export—marked **Unresolved**, because `E-05` lacks edit history. `H-03`: a genuine second door opening—marked **Contradicted** by entrance CCTV `E-01`. No fake AI probability scores—just raw evidentiary relationships." | Cursor scans the three hypothesis cards: `H-01` (Inferred / Blue), `H-02` (Unresolved / Gold), `H-03` (Contradicted / Coral). | *If hypothesis badges render plain text:* "The three cards lay out the evidence: H-01 supported by log structure, H-03 directly contradicted by CCTV." |

---

### 2:15 – 2:35 | Live Update: Adding Staged Evidence E-07

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **2:15 – 2:23** | "Now for our live moment. A detective brings in a new file: `E-07`, the main gate CCTV export covering 21:10 to 21:30. Watch what happens when we ingest it live." | Click **Dashboard** in sidebar. Scroll down to the **Live demo** panel showing `E-07 Main gate CCTV`. Click **Add E-07 to CASE-001**. | *If button click fails / throws 409:* Switch to terminal and run: `curl -s -X POST http://localhost:8000/api/cases/CASE-001/staged/E-07 && refresh browser`. |
| **2:23 – 2:35** | "The engine incorporates `E-07`. Claim `CL-07` is added as Supported: no vehicle left the gate. But look at what the system reports under 'Did not change': `CL-06`—whether asset `EQ-4471` was on the trolley—remains **Unresolved**. The system honestly reports what new evidence solves, and what it does not." | Highlight the green **Change Summary** card: `Added: E-07, EV-022, CL-07`. Focus cursor on the list under **Did not change**: `CL-06 remains unresolved`. | *If change card is not visible:* "On the dashboard, the change summary records the addition of E-07 and EV-022, while confirming asset status remains unresolved." |

---

### 2:35 – 2:50 | Export Report: Audit-Ready Deliverable

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **2:35 – 2:44** | "An investigation is only as good as its deliverable. We navigate to the Report Builder. Here is the complete case synthesized into seven structured sections: Scope, Source Inventory with SHA-256 hashes, Reconstructed Timeline, Conflicts, Hypotheses, Unresolved Questions, and Limitations." | Click **Report** in sidebar navigation (`/cases/CASE-001/report`). Scroll smoothly down the report preview. | *If report page is slow:* Navigate directly to `/cases/CASE-001/report`. |
| **2:44 – 2:50** | "Notice our permanent banner: 'Investigative aid only. Does not determine responsibility or guilt.' Investigators can export the report in clean Markdown or structured JSON for court or compliance filings." | Point cursor to the disclaimer banner at the top, then to the **Download Markdown** and **Download JSON** action buttons. | *If download buttons show placeholder message:* "As indicated in our build plan, report export endpoint integration is in progress; the live preview shows the exact markdown structure." |

---

### 2:50 – 3:00 | Close (The Core Thesis)

| Time | Presenter Spoken Script | Screen Action & UI State | Fallback Line (If Issue Occurs) |
| :--- | :--- | :--- | :--- |
| **2:50 – 3:00** | "Ghost Protocol is evidence intelligence built on four non-negotiable pillars: evidence first, visible reasoning, preserved uncertainty, and human accountability. It doesn't tell you who to blame; it shows you what the evidence proves, what it refutes, and what is still unknown. Thank you." | Return to **Dashboard** or hold on the Report Overview screen. Camera returns to presenter. | *If audio cuts out or slide ends early:* Conclude with the core phrase: "Ghost Protocol: Evidence first, uncertainty preserved, humans accountable." |

---

## 3. Presenter Troubleshooting & Live Fallback Playbook

| Failure Mode | Immediate Presenter Action | Spoken Recovery Line |
| :--- | :--- | :--- |
| **Frontend server disconnects / 500 error** | Open terminal, run `npm run dev` in `frontend/`, refresh browser. | "Our workstation hot-reloads instantly; let's refresh the client connection." |
| **Backend API unreachable** | Run `.venv/bin/uvicorn app.main:app --reload --port 8000` in `backend/`. | "Restarting our local FastAPI service on port 8000—let's pull the live case data." |
| **E-07 was already added prior to demo** | Run `curl -X POST http://localhost:8000/api/demo/reset`, refresh `/dashboard`. | "Let's reset CASE-001 to its seeded baseline to demonstrate the live ingestion step." |
| **Navigation link unresponsive** | Use the pinned direct browser URLs: `/dashboard`, `/cases/CASE-001/timeline`, `/cases/CASE-001/conflicts?c=C-01`, `/cases/CASE-001/hypotheses`, `/cases/CASE-001/report`. | "Let's jump straight to our conflict inspector view." |
| **Screen resolution issues** | Press `Ctrl + 0` (or `Cmd + 0`) to reset browser zoom level. | "Let's reset our display scale for a clean view of the timeline." |

---

## 4. Presenter Quick-Cue Card

```
[0:00 - 0:20] THE PROBLEM: Fragmented data, drifted clocks, copied logs, lost uncertainty.
              [Click: /dashboard]
[0:20 - 0:45] CASE-001: Asset EQ-4471, 21:00-22:00 window, 6 evidence items, SHA-256 hashes.
              [Click: /cases/CASE-001/timeline]
[0:45 - 1:10] DUAL TIME: EV-014 shows source 21:16:00 vs. normalized 21:14:00 (-120s offset).
              EV-018 witness estimate ~21:18. Never overwrite source time!
[1:10 - 1:35] C-02 OFFSET: RULE-TIME-001, E-02 camera runs 120s fast. Metadata declared.
              [Click: /cases/CASE-001/conflicts?c=C-02]
[1:35 - 1:55] C-01 COPIED LOG: RULE-DUP-001, E-05 r7 copied from E-04 r18 at 21:09.
              Before entry at 21:10. Review prompt, NOT proof of tampering!
              [Click: /cases/CASE-001/conflicts?c=C-01]
[1:55 - 2:15] HYPOTHESES: H-01 (Inferred), H-02 (Unresolved), H-03 (Contradicted).
              No fake AI probabilities!
              [Click: /cases/CASE-001/hypotheses?c=C-01]
[2:15 - 2:35] LIVE E-07: Ingest Main Gate CCTV. CL-07 Added (Supported).
              Honesty: CL-06 remains Unresolved!
              [Click: /dashboard -> "Add E-07 to CASE-001"]
[2:35 - 2:50] REPORT: 7 sections, disclaimer, unedited contradictions, export MD/JSON.
              [Click: /cases/CASE-001/report]
[2:50 - 3:00] CLOSE: Evidence first, reasoning visible, uncertainty preserved, human in charge.
```
