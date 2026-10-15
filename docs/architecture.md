# Architecture

How Ghost Protocol is built today. Items marked *(in review)* are in an open pull request and
not yet on `main`.

## Overview

```
 Browser ──► Next.js (frontend/)  ──server-side fetch──►  FastAPI (backend/)
             pages, server actions                         routes ─► services ─► in-memory store
                                                                       │            │
                                                                       ▼            ▼
                                                               seed files      content-addressed
                                                          (backend/app/seed)   file store (uploads)
```

- The browser never calls the API for writes. Buttons and forms go through **Next.js server
  actions**, which validate input and call the API from the server.
- The API is a thin HTTP layer. All logic lives in **plain Python services** that are tested
  without HTTP.
- There is **no language model** anywhere in the pipeline. Every result is produced by fixed,
  inspectable code and is the same for the same inputs.

## Backend (`backend/app`)

| Module | Responsibility |
| --- | --- |
| `models/domain.py` | The shared contract: `Case`, `EvidenceItem`, `Event`, `Conflict`, `Claim`, `Hypothesis`, `AuditEvent`, `ChangeSummary`, request models. The TypeScript mirror is `frontend/src/lib/types.ts`. |
| `services/ingest.py` | Loads a seed case: hashes and parses CSV logs, builds events from seed metadata for video/audio/PDF (marked simulated), loads claims, hypotheses and staged evidence. |
| `services/normalize.py` | Turns a recorded source time into a UTC normalized time plus the rule used. Never edits the source time. An unknown timezone is never assumed to be UTC. |
| `services/rules.py` | Deterministic conflict rules (below). Each returns findings with what it compared and what it cannot tell. |
| `services/store.py` | In-memory case store. Runs every rule on load and again whenever evidence is added; keeps the audit trail, live-change summaries and *(in review, #28)* reviewer decisions across re-analysis. `reset()` rebuilds everything from the seed. |
| `storage/validation.py`, `storage/hashing.py` | Upload checks: extension and content signature must agree, size limit while streaming, SHA-256 of the original bytes, storage by digest, clean filenames (@mallison031). |
| `report/` | Markdown and JSON report built from live case data (@Riel101). |
| `api/routes/` | HTTP only: `cases`, `live` (staged evidence), `report`, `demo` (health, reset), `evidence_upload` *(wired to storage in #19, in review)*, `reviews` *(#28, in review)*. |
| `errors.py` | One error shape for every failure; unexpected errors return a generic message, never a stack trace. |

### Pipeline

1. **Ingest:** each evidence item gets an ID, ingestion time, clock assumption and, when there is
   a file, a SHA-256 of the original bytes.
2. **Extract:** CSV rows inside the incident window become events with a `row N` locator.
   Video, audio and PDF events come from seed metadata and are labeled `simulated`.
3. **Normalize:** `normalized = source − offset` where a positive offset means the source clock
   runs fast. Approximate times carry an uncertainty in seconds.
4. **Compare:** every rule runs over all events and claims (below).
5. **Review:** claims and hypotheses carry one of four states; reviewers record decisions.
6. **Report:** everything above, including contradictions and unknowns, exported as a file.

### Rules

| Rule | Finds | Severity | Says it cannot tell |
| --- | --- | --- | --- |
| `RULE-DUP-001` | A log row repeated in another source with the same badge, door and event code but a different time. The copy (the row in the non-authoritative source) becomes **Contradicted**. | High | Whether the copy came from an import job, a manual edit, or a genuine second event. |
| `RULE-TIME-001` | A source with a declared clock offset; lists the events it adjusted. | Medium | Whether the offset was constant over the whole recording. |
| `RULE-TIME-002` | A source whose clock offset was inferred: the median of its anchor deltas against reference-clock sources. Reports every anchor pair and the spread. | Medium | Whether the offset held outside the anchored moments, and whether each anchor pair records the same moment. |
| `RULE-CLAIM-001` | An identity claim that no source supports. | Review | Who the person is; appearance on camera does not establish identity. |

Conflict IDs (`C-01`…) follow rule order, so the same inputs always produce the same IDs.

### Claim states

Supported · Contradicted · Inferred · Unresolved. Criteria are in
[demo-scenario.md](demo-scenario.md#claim-state-criteria). Hypotheses use the same states; a
reviewer can add notes but cannot override a state, because it comes from the evidence.

### Data storage

| What | Where | Lifetime |
| --- | --- | --- |
| Cases, events, conflicts, claims, audit | Process memory | Until restart or `POST /api/demo/reset` |
| Seed logs | `backend/app/seed/case_001/*.csv` (in git) | Permanent, read-only |
| Uploaded files *(#19)* | `GP_STORAGE_DIR` (default `backend/data/evidence`, git-ignored), named by SHA-256 | Until deleted by hand |

A database can replace the in-memory store behind the same `CaseData` methods. The README's data
model section lists the intended tables.

## API

Live schema: `http://localhost:8000/docs`. All errors use
`{"error": {"code", "message", "details"}}`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET, POST | `/api/cases` | List; create an empty case (validated, timezone required) |
| GET | `/api/cases/{id}` | Summary with counts |
| GET | `/api/cases/{id}/evidence` | Inventory |
| POST | `/api/cases/{id}/evidence` | Upload *(#19)* |
| GET | `/api/evidence/{evidence_id}` | One item |
| GET | `/api/cases/{id}/evidence/{evidence_id}/original` | Original CSV rows, read-only; 404 `original_not_available` for simulated items |
| GET | `/api/cases/{id}/timeline` | Events, sorted by normalized time |
| GET | `/api/cases/{id}/conflicts` | Rule output |
| GET | `/api/cases/{id}/claims`, `/hypotheses` | With evidence links |
| GET | `/api/cases/{id}/audit` | Newest first |
| GET | `/api/cases/{id}/staged` | Held-back evidence for the live demo |
| POST | `/api/cases/{id}/staged/{evidence_id}` | Add it, re-run rules, return what changed and what did not |
| GET | `/api/cases/{id}/changes` | All change summaries |
| POST | `/api/cases/{id}/reviews` | Reviewer decision or note *(#28)* |
| GET | `/api/cases/{id}/report?format=md\|json` | Report download |
| POST | `/api/demo/reset` | Restore the seeded state |

## Frontend (`frontend/src`)

| Path | Contents |
| --- | --- |
| `app/(site)/` | Public pages: home, Contact, Pricing |
| `app/(workstation)/` | Dashboard, cases, create case, and per case: timeline, conflicts, hypotheses, evidence, intake *(#29)*, report |
| `app/(workstation)/**/actions.ts` | Server actions for every write (add live evidence, reset, create case, reviews, upload) |
| `components/`, `features/` | Shared pieces (logo, state badge, panels) and screen-specific forms |
| `lib/api.ts`, `lib/types.ts` | Typed API client and contract mirror |
| `lib/*.ts` + `*.test.ts` | Pure helpers (filters, labels, validation) with Vitest tests |
| `styles/tokens.css` | Design tokens from the Figma brand board |

Pages are server-rendered and read the API on every request (`cache: "no-store"`), so the screen
always reflects the current case state. Filters and selection live in the URL, so they work
without client JavaScript and survive a reload.

## Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| Engine | pytest | Normalization edge cases, CASE-001 known answers, blind CASE-002, determinism |
| API | pytest + TestClient | Every route, error shapes, reset, live evidence, reviews, uploads |
| Frontend | Vitest + Testing Library | Helpers and components |
| CI | GitHub Actions | Lint, type-check, tests and build on every pull request *(#26)*; AI co-author check |

## Decisions

- **No graph database.** The "temporal evidence graph" is events, evidence links and conflict
  references in ordinary tables. Nothing in the demo needs graph queries.
- **No LLM in the core.** Clock offsets and copied records are found by rules with stable IDs, so
  results are reproducible and testable.
- **In-memory store for the demo.** Reset must return a known state in milliseconds; persistence
  is not needed to show the workflow.
- **Server actions instead of browser API calls.** Keeps the API off the public internet in a
  deployment and puts validation on the server.
