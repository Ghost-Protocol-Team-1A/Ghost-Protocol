# Code walkthrough: everything we built, and how to explain it

For the whole team, so anyone can answer a judge's question about any part of Ghost Protocol.
Read Part 1 (tools) and Part 2 (the big picture) first; every later part is a file-by-file tour
with the lines that matter and the sentence to say about them.

**The one sentence:** Ghost Protocol turns scattered incident evidence into one inspectable
timeline, flags contradictions with named rules, lets AI read and draft with citations, and ends
with a conclusion a named person signs, without ever saying who is guilty.

---

## Part 1 · Every tool we use

### Languages

| Tool | Where | Why we chose it | What to say |
| --- | --- | --- | --- |
| **Python 3.12** | `backend/` | Best ecosystem for data parsing, PDFs, spreadsheets and the Anthropic SDK. | "The evidence engine is Python." |
| **TypeScript 5** | `frontend/` | JavaScript with types, so mistakes are caught before the app runs. | "The website is TypeScript, type-checked on every change." |
| **CSS Modules** | `*.module.css` | Each component's styles are private to it, so pages never break each other. | "Plain CSS, scoped per component, no styling framework." |
| **SQL (PostgreSQL)** | `backend/app/services/persist.py` | Two simple tables keep cases across restarts. | "Cases are saved in Postgres." |

### Backend (the evidence engine)

| Tool | Version | What it does for us |
| --- | --- | --- |
| **FastAPI** | ≥ 0.115 | The web framework for the engine's API: 37 endpoints such as `GET /api/cases/{id}/timeline`. It reads our data models and validates every request automatically. |
| **Uvicorn** | ≥ 0.30 | The server process that runs FastAPI. |
| **Pydantic** | ≥ 2.8 | Defines every record (Case, Evidence, Event, Claim, Conflict…) in `models/domain.py`. Rejects bad input with a clear error before our code sees it. |
| **python-multipart** | ≥ 0.0.9 | Lets FastAPI receive uploaded files. |
| **Anthropic SDK** (`anthropic`) | ≥ 0.75 (installed 1.15) | Calls **Claude Sonnet 5.5** for AI suggestions, briefings and questions. |
| **pypdf** | ≥ 5 | Reads the text out of a PDF so we can check that a quote the AI gave really is in the document. |
| **openpyxl** | ≥ 3.1 | Writes the Excel workbook that Power BI and Tableau open. |
| **psycopg 3** | ≥ 3.2 | Talks to PostgreSQL to save and restore cases. |
| **pytest** | ≥ 8 | Runs the 161 backend tests. |
| **httpx** | ≥ 0.27 | Lets tests call the API like a real client. |
| **Ruff** | ≥ 0.6 | Lint: catches unused code, unsorted imports, long lines. |

Standard-library pieces that do real work: `csv` and `json` (parsing logs), `hashlib`
(SHA-256 fingerprints), `zipfile` (reading Word files and writing the CSV export), `statistics.median`
(the clock-offset maths), `datetime` (every time conversion).

### Frontend (the website)

| Tool | Version | What it does for us |
| --- | --- | --- |
| **Next.js** | 15.5.4 | The website framework. Pages are rendered **on the server**, so the browser never talks to the engine directly. Uses the *App Router*: each folder under `app/` is a page. |
| **React** | 19.1 | Builds the interface from components. React 19 *server actions* handle every form: the form posts to a function on our server, which calls the engine. |
| **Vitest** | 3.2 | Runs the 68 frontend tests. |
| **Testing Library** + **jsdom** | 16 / 26 | Render components in tests as a user would see them. |
| **ESLint** (Next config) | 9 | Lint for the website. |
| **TypeScript compiler** (`tsc --noEmit`) | 5 | Type-check on every change. |

No chart library, no UI kit, no CSS framework: charts are hand-built HTML and SVG, so they match
the design exactly and the page stays small (about 106 KB of JavaScript on first load).

### Fonts and design

| Tool | Use |
| --- | --- |
| **Inter** and **JetBrains Mono** (Google Fonts via `next/font`) | Interface text, and IDs/times/rule codes. |
| **Figma** | Every screen designed first, in section *v2 · Black + Lime*. The HTML that generates our frames is kept in `design/`. |
| **Two brand colours** | Ink `#0A0B0D` and Signal Lime `#B8F54A`. Four state colours appear only inside data (supported, contradicted, inferred, unresolved). |
| **Colour-blind palette validator** | Chart colours were computed and checked, not eyeballed (see `design/README.md`). |

### AI

| Tool | Use |
| --- | --- |
| **Claude Sonnet 5.5** (`claude-sonnet-5-5`) by Anthropic | Reads documents and photos, compiles the case briefing, answers questions about the case, drafts conclusion wording. |
| **Structured outputs** (JSON schema) | The AI must answer in an exact JSON shape, which our code checks. |
| **Server-side fallback** | If Claude declines a request, Anthropic retries it on another model. If our account cannot use that option, the code retries once without it. |

### Infrastructure and delivery

| Tool | Use |
| --- | --- |
| **Docker** | One container image holds both the website and the engine (`Dockerfile`, three build stages). |
| **Render** | Hosts the container (web service *ghost-protocol-demo*, Frankfurt) and the database (*ghost-protocol-db*, free PostgreSQL 17). Live at https://ghost-protocol-demo.onrender.com. |
| **PostgreSQL 17** (Render) | Saves investigators' cases and uploaded originals so they survive restarts. |
| **UptimeRobot** | Pings `/healthz` every 5 minutes, keeping the free server awake and alerting us if it goes down. |
| **GitHub** | Code, pull requests, reviews. Every change went through a pull request reviewed by a teammate. |
| **GitHub Actions** | `ci.yml` runs lint, type-checks, tests and a build on every pull request. `contributor-check.yml` blocks AI co-author lines in commits. |
| **Branch protection** | `main` needs one approval, passing checks and a linear history. |

---

## Part 2 · The big picture

### How a request travels

```
Judge's browser
   │  HTTPS
   ▼
Next.js website  (public, port $PORT)        ← pages, forms, downloads
   │  server-side fetch, never from the browser
   ▼
FastAPI engine   (private, 127.0.0.1:8000)   ← rules, AI calls, storage
   │
   ├── PostgreSQL (saved cases and original files)
   └── Anthropic API (Claude, only when someone uses an AI feature)
```

**What to say:** "The engine is never on the internet. The browser only talks to the website, and
the website talks to the engine inside the same container. That is a security choice: there is
no public API to attack."

### The pipeline (the six steps on screen)

1. **Ingest:** file checked against its contents, fingerprinted with SHA-256, stored by its hash.
2. **Extract:** logs parsed into events; people log what recordings show; AI proposes events from documents.
3. **Normalize:** every event keeps its original time and gets a corrected time, with the rule that made it.
4. **Compare:** named rules flag conflicts (copied records, clock errors, unsupported identity).
5. **Review:** people decide each conflict, with a reason, recorded in the audit trail.
6. **Report:** questions, findings and a signature; unknowns stay in the export.

### The four claim states

Supported (a cited source records it), Contradicted (a source conflicts), Inferred (follows only
from several sources), Unresolved (the evidence can't settle it). No percentages, on purpose.

---

## Part 3 · The engine, file by file (`backend/app/`)

### `main.py`: the front door
- `create_app()` builds the FastAPI app, adds CORS, installs one error format, registers every router.
- `save_after_writes` middleware: after any successful POST, PUT, PATCH or DELETE it calls
  `store.save()`, which writes every case that changed. **Say:** "Every change is saved the moment it happens."

### `errors.py`: one error shape
- `ApiError(status, code, message, details)` is raised anywhere; the handler always returns
  `{"error": {"code", "message", "details"}}`. The website shows `message` directly to the user.

### `models/domain.py`: the vocabulary
Every record is a Pydantic model. The ones to know:
- `EvidenceItem`: `sha256`, `clock` (offset, method, anchors), `recorded_at` (start time read from a video file), `extraction_method`.
- `Event`: `source_time` (never changed), `normalized_time` (UTC), `normalization_rule` (how), `state`, `extracted_by` (the person, for observations and accepted AI).
- `Conflict`: `rule_id`, `explanation`, `uncertain` ("what this rule cannot tell"), `status`.
- `Claim`, `Question`, `Conclusion`, `Answer`, `Finding`: the human verdict.
- `Suggestion`, `Briefing`, `AskAnswer`, `Draft`: what the AI produces.
- Input models (`CaseCreate`, `ClaimCreate`, `ConclusionCreate`, `ClockUpdate`…) carry the limits, e.g. `Field(min_length=20)` on an answer.

### `services/normalize.py`: two times, one event
- `normalize(source_time, offset_seconds, approximate_seconds)` returns the corrected UTC time and a rule string like `clock_offset:-120s (source clock 120s fast)`.
- A time without a timezone is **never** assumed to be UTC; the corrected time is left empty.
- **Say:** "We never overwrite a timestamp. The original stays, and the rule that changed it is stored next to it."

### `services/offsets.py`: working out a wrong clock (RULE-TIME-002)
- An *anchor* pairs a moment in an untrusted source (camera sees the door open) with the same moment in a trusted source (access log row 18).
- `infer_offset()` computes each pair's difference, takes the **median** (one bad pair can't drag it far), and keeps the **spread** as uncertainty.
- Only anchors against a source on the reference clock count.
- **Say:** "Nobody told it the camera was two minutes fast. Two independent moments both said +120 seconds."

### `services/rules.py`: named rules
- `rule_dup_001`: same badge, door and event code in two sources at different times → possible copied record. The explanation always says "not proof of tampering".
- `rule_time_001`: a declared clock offset. `rule_time_002`: an inferred one, listing every anchor pair.
- `rule_claim_001`: an identity claim with no supporting citation.
- `apply_findings_to_events` marks the copy as contradicted.
- **Say:** "Every flag has a stable rule ID, what it compared, and what it cannot tell us."

### `services/ingest.py`: loading the demo case
- Reads `seed/case_001/case.json` and the CSV logs, hashes the real CSVs, builds events, and applies inferred clock offsets.
- `load_staged` brings in E-07, the evidence held back for the live "add new evidence" moment.

### `services/extract.py`: turning uploads into events
- `parse_log(kind, bytes, window_start)` handles CSV, JSON and text logs. It finds the time column, reads each row and keeps a locator (`row 3`, `line 12`).
- A time with no date is never guessed. A time with no timezone takes the case's, and the event's rule says so.
- `media_start_time` reads the recording start time from inside an MP4/MOV/M4A file (the `mvhd` box), shown as "not verified".

### `services/store.py`: the case in memory
- `CaseData` holds one case: evidence, events, claims, conflicts, reviews, questions, conclusions, suggestions, briefings, audit.
- `_analyze(events)` re-runs every rule. It first resets states the rules set, so a conflict that disappears no longer marks its records. Human decisions are re-attached by what the rule found, so they survive re-analysis.
- `add_events` / `_change` record **what changed and what did not** after new evidence.
- `renormalize` re-times a source's events after its clock changes.
- `snapshot()` / `restore()` turn a case into JSON and back. Conflicts are re-derived on load, never stored.
- `Store.reset()` loads the seeds plus every saved case. `reset_demo()` resets only CASE-001. `save()` writes only cases that changed.

### `services/persist.py`: surviving restarts
- `PostgresBackend` (when `DATABASE_URL` is set): tables `gp_cases` (one JSON document per case) and `gp_blobs` (original files by SHA-256).
- `FileBackend` (`GP_DATA_DIR`) for local runs; `NullBackend` for tests.
- The demo case is never saved, so the seed always wins.
- **Say:** "Your case survives a deploy. We proved it live: created a case, redeployed, it was still there."

### `services/findings.py`: where people reach a verdict
- `check_claim`: the state must match the citations. Supported needs a supporting citation, Contradicted a contradicting one, Inferred at least two; Unresolved needs none.
- `sign_conclusion` refuses to sign unless: every question is answered exactly once; every citation exists; "Established" cites a **supported** claim; no conflict is still open; both attestations are ticked. Each signature is a new version that supersedes the last.
- `journey()` works out the six steps and the single next action for the overview and the bar.
- **Say:** "The software won't let you sign a verdict the evidence doesn't carry."

### `services/ai.py`: Claude, checked
- `_call()` sends one request to `claude-sonnet-5-5` with a JSON schema, so the answer has an exact shape. It handles refusals and errors, and shows Anthropic's own message if something fails.
- `case_context()` writes the case as plain lines with IDs, every time in site local time ("recorded 21:16 | corrected 21:14").
- `suggest_events()` sends a PDF (as a document), a photo (as an image), a Word file or text, and asks for events the document states, each with an exact quote.
- `quote_found()` checks that quote against the document's own text, so the user sees "✓ Quote found" or a warning.
- `keep_cited()` drops any briefing point whose citation doesn't exist, and counts how many were removed.
- `briefing()`, `ask()`, `draft_answer()`: the three other AI features.
- The `RULES` prompt: use only the given material; cite IDs; never say who is guilty; say when the records can't tell.
- **Say:** "We don't trust the AI's word. Code checks every citation and every quote, and nothing it proposes reaches the record until a person accepts it."

### `services/export.py`: Power BI and Tableau
- `tables()` builds tidy tables: evidence, events, claims, claim_citations, conflicts, questions, audit. They join on `*_id` columns, with real UTC datetimes.
- `workbook()` writes an `.xlsx` with an *about* sheet of loading steps; `csv_zip()` gives the same tables as CSV.

### `storage/validation.py` and `storage/hashing.py`: upload safety (built by @mallison031)
- 33 allowed formats. Each extension must match the file's **first bytes**, so a renamed `.exe` called `.pdf` is rejected.
- Filenames are cleaned (no `../`, no control characters) and only ever stored as metadata.
- Files are hashed in chunks with a size limit enforced while reading, and stored under their SHA-256, so duplicates are recognised.

### `report/`: the report (built by @Riel101)
- `builder.py` assembles sections: scope, evidence, timeline (both times), conflicts with rules, hypotheses, unresolved questions, methods and limits, all claims, then questions & findings and sign-off.
- `markdown.py` renders the same structure as Markdown. The JSON version is the same data.

### `api/routes/`: the endpoints
| File | Endpoints |
| --- | --- |
| `cases.py` | list, create and read cases; evidence, timeline, conflicts, claims, hypotheses, audit, original rows |
| `evidence_upload.py` | upload (check, hash, store, extract), stream the original with Range support |
| `workbench.py` | log an observation at a timecode; set a source's clock |
| `findings.py` | questions, claims, sign conclusion, journey |
| `ai.py` | AI status, suggestions, accept/reject, briefing, ask, draft |
| `reviews.py` | record a decision on a conflict or a note on a hypothesis |
| `live.py` | add held-back evidence E-07 and return what changed |
| `report.py`, `export.py` | report download, BI export |
| `demo.py` | health check, reset the demo case |

---

## Part 4 · The website, file by file (`frontend/src/`)

### How a page works
Each `page.tsx` is an **async server component**: it calls `api.*` (in `lib/api.ts`) on the
server, then returns HTML. Forms use **server actions** (`"use server"` files), which validate the
input, attach the signed-in name, call the engine and refresh the page. Interactive parts (palette,
tour, forms with state, graph hover) are small `"use client"` components.

### `lib/` (logic, all unit-tested)
| File | What it does |
| --- | --- |
| `api.ts` | Every call to the engine, server-side only; turns engine errors into `ApiError`. `localTime()` shows site time. |
| `types.ts` | TypeScript versions of the engine's models. |
| `identity.ts`, `session.ts` | Demo sign-in: name and role in an httpOnly cookie. No password, and the page says so. |
| `lanes.ts` | Places events on source lanes; finds the busiest 12 minutes. |
| `graph.ts` | Builds the evidence graph: evidence → events → claims → conflicts. |
| `analytics.ts` | Counts for the analytics charts, following the filters. |
| `palette.ts` | Ranks ⌘K search results: exact IDs first, then prefixes. |
| `tour.ts` | The seven guided-demo stops. |
| `cases.ts`, `intake.ts`, `evidence.ts`, `labels.ts`, `timeline.ts`, `report.ts`, `dashboard.ts` | Form checks, accepted formats, labels and helpers for their pages. |

### `features/` (components)
| Folder | What it is |
| --- | --- |
| `shell/` | Sidebar that follows the case you're in (Build → Analyse → Decide), top bar with sign-in. |
| `workbench/` | Step tracker, journey bar with **Next →**, every journey form (observation, clock, AI suggestion card, question, claim, conclusion, briefing, ask). |
| `timeline/` | Source lanes, showing where each clock put an event. |
| `graph/` | Interactive evidence graph (SVG). |
| `analytics/` | Six charts with table views and keyboard tooltips. |
| `palette/` | ⌘K command palette. |
| `tour/` | Guided demo card with spotlight. |
| `evidence/` | Player for uploaded audio, video, images and PDFs. |
| `intake/`, `cases/`, `review/`, `audit/`, `site/` | Upload form, create-case form, review form, audit table (by @Blessed-Femi), contact form (by @Waffiyyi). |

### `app/` (pages)
- `(site)/`: public pages: home (live timeline), platform, services, why, guide, resources, white paper, pricing, contact.
- `(auth)/`: sign in, register.
- `(workstation)/`: dashboard, cases, and per case: overview, intake, extract, evidence, timeline, graph, analytics, assistant, conflicts, hypotheses, questions, conclusion, report, audit.
- Route handlers stream files without exposing the engine: report download, BI export, evidence file, search index, health check.

---

## Part 5 · Quality and safety

- **Tests:** 161 backend + 68 frontend. Highlights:
  - known answers for the demo case;
  - a **blind case** written before the data (by @Aycode01) proving nothing is hard-coded;
  - a simulated restart;
  - AI checks run against a fake Claude, so tests never spend money.
- **CI** (by @Orah-dev): lint, types, tests and a build on every pull request; a check that blocks AI co-author lines.
- **Determinism:** ten repeated analyses give byte-identical output.
- **Security:**
  - the engine isn't reachable from the internet;
  - uploads are checked against their bytes;
  - originals are served with `nosniff` and a sandbox, so a file can't run as a page;
  - the AI key and database URL live only in Render's environment, never in git.

---

## Part 6 · Questions judges ask, and the line to point at

| Question | Answer | Point at |
| --- | --- | --- |
| Is this just ChatGPT? | No. The engine is deterministic rules with IDs; AI only assists, and every citation and quote is checked in code. | `services/rules.py`, `ai.py → keep_cited, quote_found` |
| How do you know the camera was 2 minutes fast? | Two moments it shares with trusted clocks; median of the differences. | `services/offsets.py → infer_offset` |
| Can the AI accuse someone? | It's told not to, and on the live site "Who took the asset?" answers "the records do not say". A person signs. | `ai.py → RULES`, `findings.py → sign_conclusion` |
| What if new evidence arrives? | Rules re-run and it shows what changed and what didn't. | `store.py → _change` |
| Can I trust an upload? | Checked against its bytes, fingerprinted, never modified; the hash is in the report. | `storage/validation.py`, `hashing.py` |
| Does it scale / persist? | Cases are saved in Postgres after every change; one container today, and the engine already separates storage behind one interface. | `services/persist.py` |
| Can it go into Power BI? | One click: an Excel workbook of joined tables. | `services/export.py` |
| What's simulated? | Demo-case video and audio events come from metadata and are labelled. Uploaded media is real, and people or the AI add its events. | Evidence page labels |
