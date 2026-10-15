# Ghost Protocol

**Evidence intelligence for incident investigations.**

Ghost Protocol turns fragmented evidence (camera clips, access logs, audio, inventory records and
witness statements) into one timeline you can inspect. It aligns clocks without losing the
original timestamps, flags records that contradict each other, and shows for every conclusion
whether the evidence **supports**, **contradicts**, merely **infers**, or **cannot resolve** it.

It does not decide who is responsible. It shows investigators what the evidence says and what
it doesn't.

**Live demo:** https://ghost-protocol-hbwg.onrender.com/dashboard — fictional data; press
**Reset demo** on the dashboard to start clean. If it has been idle, the first load can take up
to a minute.

> **Status: the full demo workflow runs end to end.**
> CASE-001 loads; times are normalized; three rules detect C-01, C-02 and C-03; and an
> investigator can filter the timeline, inspect conflicts, record review decisions, compare
> hypotheses, upload evidence, add evidence live, and export the report. 102 backend and 25
> frontend tests run on every pull request. Open: the audit trail page (#31, in review).

---

## Contents

- [The problem](#the-problem)
- [What Ghost Protocol does](#what-ghost-protocol-does)
- [Product principles](#product-principles)
- [The demo: CASE-001](#the-demo-case-001)
- [How it works](#how-it-works)
- [Claim states](#claim-states)
- [Architecture](#architecture)
- [API](#api)
- [Data model](#data-model)
- [Design](#design)
- [Repository layout](#repository-layout)
- [Running locally](#running-locally)
- [Documentation](#documentation)
- [Team](#team)
- [Build plan](#build-plan)
- [Responsible use](#responsible-use)
- [Known limitations](#known-limitations)

---

## The problem

One incident can leave behind hours of video, several logs on different clocks, an audio
recording and conflicting statements. Investigators cross-reference these by hand. Clocks
disagree, copies of logs drift from the originals, and once evidence is summarized, the
uncertainty tends to disappear.

## What Ghost Protocol does

1. **Ingests evidence** and records where every item came from: SHA-256 hash, ingestion time, original filename.
2. **Extracts events** with an exact pointer back to the source (timecode, CSV row, PDF page and paragraph).
3. **Normalizes time.** Each event keeps its original source time and gets a separate normalized time, with the rule that produced it.
4. **Runs deterministic rules** that flag clock offsets, copied or duplicated records, and claims that lack evidence. Each flag names the rule and the records it compared.
5. **Separates fact from interpretation.** Every claim carries one of four states and cites its evidence.
6. **Compares hypotheses** side by side, without probability scores the evidence can't justify.
7. **Exports a report** that keeps contradictions and unresolved questions in, rather than smoothing them away.

## Product principles

- **Evidence first.** Every claim links back to its source material.
- **Reasoning visible.** Every conflict names the rule that found it and the records it compared.
- **Uncertainty preserved.** Supported, contradicted, inferred and unresolved stay distinct all the way into the report.
- **Original data is never overwritten.** Source timestamps and files are kept as received; transformations are stored alongside.
- **Humans accountable.** Reviewers make the decisions. The system never labels a person as responsible.

---

## The demo: CASE-001

A **fictional** warehouse incident. Asset EQ-4471 is recorded as secured at 21:00 and found
missing at 22:00. Six evidence items:

| ID   | Item                  | Seeded behavior                                   |
| ---- | --------------------- | ------------------------------------------------- |
| E-01 | Entrance CCTV         | Reference clock                                   |
| E-02 | Loading-bay CCTV      | **Clock runs 2 minutes fast**                     |
| E-03 | Door alarm audio      | Reference clock                                   |
| E-04 | Door access log (CSV) | Reference clock; row 18 = loading-bay door opens  |
| E-05 | Inventory log (CSV)   | **Row 7 is a copy of E-04 row 18 stamped 21:09**  |
| E-06 | Witness statement     | Approximate time ("around 21:18")                 |

What the system must show:

- **C-02 · Clock offset (RULE-TIME-001).** E-02's trolley event: source **21:16:00**, normalized **21:14:00**. Both times are shown, with the reason.
- **C-01 · Copied log record (RULE-DUP-001).** E-05 row 7 duplicates E-04 row 18 but is stamped 21:09:00, before anyone enters at 21:10:00. Flagged for review; **not** called tampering.
- **Identity not established.** Nothing links the person on camera to a badge. The claim stays Unresolved.
- **Live update.** Adding a new evidence item (E-07) updates the case, and the system says which conclusions did *not* change.

The complete scenario, expected answers and acceptance checklist are in
**[docs/demo-scenario.md](docs/demo-scenario.md)**. It is the single source of truth for design, seed data and tests.

---

## How it works

```
 Evidence ──► 1 INGEST ──► 2 EXTRACT ──► 3 NORMALIZE ──► 4 COMPARE ──► 5 REVIEW ──► 6 REPORT
             hash, type,    events with    source time     deterministic   claims and     cited,
             provenance     source         kept; derived   rules → named   hypotheses,    with
                            locators       time + rule     conflicts       human review   limitations
```

| Stage     | Input                        | Output                                           | MVP approach |
| --------- | ---------------------------- | ------------------------------------------------ | ------------ |
| Ingest    | Uploaded file or seed item   | Evidence item with SHA-256, size, type, ingestion time | Real |
| Extract   | CSV / JSON                   | Events with row locators                         | Real, deterministic parser |
| Extract   | Video, audio, PDF            | Events with timecode / page locators             | **Simulated from seed metadata, labeled in the UI** |
| Normalize | Events + clock assumptions   | `normalized_time`, `offset_seconds`, rule, uncertainty | Real |
| Compare   | Normalized events            | Conflicts with rule ID, evidence pairs, explanation | Real, deterministic |
| Review    | Claims, hypotheses           | Claim states, reviewer decisions, audit events   | Real |
| Report    | Case                         | Markdown and JSON export                         | Real |

**No language model is needed for the core demo.** Clock offsets and copied records are found by
deterministic rules with stable IDs, so results are reproducible and testable. An LLM may later
draft summaries or suggest questions. Its output would be labeled as a suggestion,
schema-validated and tied to cited sources.

## Claim states

| State            | Meaning                                                         | Color  |
| ---------------- | --------------------------------------------------------------- | ------ |
| **Supported**    | A cited source directly records it and no cited source conflicts | Lime   |
| **Contradicted** | A cited source conflicts with it under a named rule             | Coral  |
| **Inferred**     | It follows from two or more cited sources; no single source records it | Blue |
| **Unresolved**   | The available evidence cannot establish or rule it out          | Gold   |

Colors are always paired with the text label, never used alone.

---

## Architecture

| Layer       | Choice                                   | Why |
| ----------- | ---------------------------------------- | --- |
| Frontend    | Next.js (App Router), React, TypeScript  | Workstation and public site in one app |
| Styling     | CSS variables from the Figma brand board | One token set for every screen |
| Backend     | Python, FastAPI, Pydantic                | Typed contracts, automatic OpenAPI docs at `/docs` |
| Domain      | Plain Python services, separate from HTTP routes | Rules and normalization are unit-testable |
| Storage     | In-memory store rebuilt from the seed (today); SQLite/PostgreSQL behind the same interface later | Deterministic, resettable demo |
| Files       | Local content-addressed store (by SHA-256) | Original bytes preserved; no user input in paths |
| Tests       | pytest, Vitest / Testing Library         | Known-answer tests against the seeded scenario |

The "temporal evidence graph" is a set of relational tables: events, evidence links and event
relations. A separate graph database, message queue or microservices would add risk without
adding anything the demo needs.

## API

All endpoints are live. FastAPI serves the schema at `/docs`; details are in
[docs/architecture.md](docs/architecture.md#api).

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/health` | Liveness |
| GET    | `/api/cases` | List cases |
| POST   | `/api/cases` | Create an empty case (incident window must include a timezone) |
| GET    | `/api/cases/{case_id}` | Case overview and counts |
| GET    | `/api/cases/{case_id}/evidence` | Evidence inventory and processing status |
| POST   | `/api/cases/{case_id}/evidence` | Upload evidence (validated, hashed, stored by digest) |
| GET    | `/api/evidence/{evidence_id}` | Evidence metadata and provenance |
| GET    | `/api/cases/{case_id}/evidence/{evidence_id}/original` | Original log rows, read-only |
| GET    | `/api/cases/{case_id}/timeline` | Events with source and normalized time |
| GET    | `/api/cases/{case_id}/conflicts` | Rule output with evidence links and review history |
| GET    | `/api/cases/{case_id}/claims` | Claims with state and citations |
| GET    | `/api/cases/{case_id}/hypotheses` | Hypotheses with supporting and contradicting evidence |
| POST   | `/api/cases/{case_id}/reviews` | Record a reviewer decision (conflicts) or note (hypotheses) |
| GET    | `/api/cases/{case_id}/audit` | Audit trail |
| GET    | `/api/cases/{case_id}/staged` | Evidence held back for the live demo |
| POST   | `/api/cases/{case_id}/staged/{evidence_id}` | Add it, re-run the rules, report what changed and what did not |
| GET    | `/api/cases/{case_id}/changes` | All change summaries |
| GET    | `/api/cases/{case_id}/report?format=md\|json` | Report download (Markdown or JSON) |
| POST   | `/api/demo/reset` | Restore CASE-001 to its seeded state |

Errors share one shape: `{"error": {"code": "...", "message": "...", "details": {...}}}`.
Stack traces are never returned.

## Data model

Today the demo keeps cases in memory and rebuilds them from the seed on reset (see
[docs/architecture.md](docs/architecture.md#data-storage)). For a database-backed version, these
are the intended tables:

| Table             | Key fields |
| ----------------- | ---------- |
| `cases`           | id, title, description, incident_start, incident_end, status |
| `evidence_items`  | id, case_id, type, source_name, original_filename, sha256, size, ingested_at, storage_ref, processing_status, extraction_method, clock_note |
| `events`          | id, case_id, evidence_id, locator, description, source_time, source_tz, normalized_time, offset_seconds, normalization_rule, uncertainty_seconds, review_state |
| `claims`          | id, case_id, statement, state, rationale, review_state |
| `evidence_links`  | id, claim_id, evidence_id, locator, relationship (supports / contradicts), explanation |
| `conflicts`       | id, case_id, type, rule_id, severity, explanation, status, reviewer_note |
| `conflict_items`  | conflict_id, evidence_id, event_id |
| `hypotheses`      | id, case_id, question, description, state, limitations |
| `hypothesis_links`| hypothesis_id, evidence_id, relationship |
| `audit_events`    | id, case_id, actor, action, entity_ref, at, details |

Evidence and audit records are append-only from the application's point of view. A correction
creates a new record; it never overwrites the original.

---

## Design

All screens are designed in Figma and are the reference for the implementation:
**[Ghost Protocol design file](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled)**

| Area | Frames |
| ---- | ------ |
| Brand | [Brand board](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=70-2) |
| Workstation | [Dashboard](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-78) · [Investigation timeline](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1381) · [Conflict inspector](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-257) · [Hypothesis comparison](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-795) · [Evidence intake](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-163) · [Evidence viewer](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-334) · [Extraction review](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-711) · [Report builder](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-413) · [Audit trail](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1056) · [Cases](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-638) · [Create case](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-937) · [Team & permissions](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-851) · [Settings & privacy](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1478) · [Mobile review](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1533) |
| Public site | [Landing](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=70-28) · [Sign in](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-256) · [Registration](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-293) · [Platform](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-406) · [Services](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-358) · [Why Ghost Protocol](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-479) · [Resources](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-158) · [White paper](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-522) · [Pricing](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-118) · [Contact](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=72-212) |
| Handoff | [Design system](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1127) · [Team build map](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1197) · [Product blueprint](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled?node-id=48-1592) |

**Palette:** Obsidian `#090C11` · Graphite `#11161C` · Signal lime `#B8F54A` · Evidence cyan
`#40D1E0` · Conflict coral `#FF5C52` · Warning gold `#FAB54F` · Inferred blue `#61A3FA`.
**Type:** Inter.

## Repository layout

```
backend/
  app/
    main.py              FastAPI app and routers
    api/routes/          HTTP layer only
    models/              Pydantic and database models
    services/            normalization, rules, claims, hypotheses
    storage/             upload validation, hashing, file store
    report/              Markdown and JSON report
    seed/                case_001.json (demo), case_002.json (blind test)
  tests/
frontend/
  src/
    app/(site)/          public pages
    app/(workstation)/   investigation workspace
    components/          shared UI (badges, tables, timeline rows)
    features/            screen-specific components
    lib/                 API client, formatting
    styles/tokens.css    design tokens from Figma
docs/                    scenario, tasks, architecture, evaluation
```

## Running locally

Requirements: Python 3.12+ and Node.js 22+.

**Backend** (http://localhost:8000, API docs at `/docs`):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**Frontend** (http://localhost:3000; open `/cases/CASE-001/timeline`):

```bash
cd frontend
npm ci
npm run dev
```

**Checks** — run these before every pull request:

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/pytest -q
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

Reset the demo at any time with `curl -X POST localhost:8000/api/demo/reset`. Configuration
comes from environment variables; copy `.env.example` to `.env` and never commit `.env`.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/demo-scenario.md](docs/demo-scenario.md) | The fictional case, expected answers and acceptance checklist |
| [docs/demo-script.md](docs/demo-script.md) | Three-minute demo, second by second, with fallbacks |
| [docs/architecture.md](docs/architecture.md) | How it is built: pipeline, rules, API, storage, decisions |
| [docs/security.md](docs/security.md) | Security controls, gaps and what a real deployment needs |
| [docs/evaluation.md](docs/evaluation.md) | How we verify it works; rehearsal checklist |
| [docs/blind-test.md](docs/blind-test.md) | CASE-002, a case the engine was not built around |
| [docs/competitors.md](docs/competitors.md) | Existing products and how Ghost Protocol differs |
| [docs/figma-review.md](docs/figma-review.md) | Every Figma frame compared with the built app |
| [docs/ci.md](docs/ci.md) | What runs on every pull request |
| [docs/team-tasks.md](docs/team-tasks.md) | Who owns what |

## Team

| Member        | Responsibility |
| ------------- | -------------- |
| [@Bolajiomo99](https://github.com/Bolajiomo99) | Lead: architecture, evidence engine, workstation, design, integration |
| [@Riel101](https://github.com/Riel101)         | Report export |
| [@mallison031](https://github.com/mallison031) | Evidence upload checks |
| [@Aycode01](https://github.com/Aycode01)       | Blind-test case |
| [@Blessed-Femi](https://github.com/Blessed-Femi) | Audit trail page |
| [@Waffiyyi](https://github.com/Waffiyyi)       | Public pages: Contact and Pricing |
| [@Orah-dev](https://github.com/Orah-dev)       | Continuous integration |
| [@DANTE-1903](https://github.com/DANTE-1903)   | Demo script and evaluation |

Details for each task: [docs/team-tasks.md](docs/team-tasks.md). How we work:
[CONTRIBUTING.md](CONTRIBUTING.md).

## Build plan

| Day | Goal | Done when |
| --- | ---- | --------- |
| 1 | Scenario and contracts locked; scaffold runs | Backend `/health` and frontend shell start locally |
| 2 | Ingestion, seed, normalization | CASE-001 loads; EV-014 shows 21:16 → 21:14 |
| 3 | Conflict rules, claims, hypotheses | C-01 and C-02 detected by tests |
| 4 | Workstation: dashboard, timeline, conflict inspector | Demo path clickable on real API data |
| 5 | Evidence viewer, hypotheses, report, audit; teammates' work merged | Report downloads; blind test runs |
| 6 | Hardening and polish against Figma | Clean-machine setup works; evaluation table filled in |
| 7 | Rehearsal and submission | Demo runs end-to-end three times in a row after reset |

If time runs short, we cut public pages before we cut the investigation workflow.

## Responsible use

Ghost Protocol is an investigative aid, not a judge.

- It never states that a person is responsible or guilty.
- A flagged contradiction is a prompt for review, not proof of tampering.
- Uploaded evidence and extracted text are treated as untrusted data and are never executed or followed as instructions.
- Demo data is fictional and labeled as such on every screen.
- Evidence is not sent to third-party AI services.

## Known limitations

- Video, audio and PDF extraction is simulated from seed metadata in the MVP and labeled as such.
- The CASE-001 clock offset is declared in the fixture, not inferred from the evidence; the UI says so.
- Authentication in the demo is not production security; the deployment is for a controlled demo only.
- Results on two small synthetic cases say nothing about accuracy on real investigations.
- "Ghost Protocol" is a working name; a similar name exists in this space (see [docs/competitors.md](docs/competitors.md)).

## Contact

Questions about the project or the demo: **info@rayvme.com** (RAYVMEDIA PLUS LTD, Lagos,
Nigeria). The contact form on the public site is a demo and does not send messages.
