# Demo scenario — CASE-001 Warehouse equipment incident

> **All data in this scenario is fictional.** No real people, sites or events are described.
> This file is the single source of truth for the seeded demo. The Figma screens, the seed
> script, the tests and the demo script must all agree with it. If you need to change a
> value, change it here first and say so in your pull request.

## Story

At a fictional warehouse, a piece of equipment (asset **EQ-4471**) is recorded as secured at
21:00 and discovered missing at 22:00. Six evidence items are collected. Each tells part of the
story; two of them disagree with the others in ways the system must surface without accusing
anyone.

All times are site local time, **2026-10-10, UTC+01:00**. Internally the application stores
UTC and keeps the original source value unchanged.

## Evidence items

| ID   | Item                   | Type       | Clock status                         | What it contributes                                   |
| ---- | ---------------------- | ---------- | ------------------------------------ | ----------------------------------------------------- |
| E-01 | Entrance CCTV clip     | video      | Reference (no offset)                | A person enters the loading area                      |
| E-02 | Loading-bay CCTV clip  | video      | **Runs 120 s fast** (seeded)         | A trolley moves through the bay; object is obscured   |
| E-03 | Door alarm audio       | audio      | Reference (no offset)                | A door alarm sounds                                   |
| E-04 | Door access log        | CSV        | Reference (no offset)                | Badge B-117 opens the loading-bay door (row 18)       |
| E-05 | Inventory event log    | CSV        | Reference, but contains a copied row | EQ-4471 secured / missing; **row 7 copies E-04 row 18** |
| E-06 | Witness statement      | PDF        | Approximate times only               | A worker heard movement "around 21:18"                |

Extraction in the MVP is **simulated from seeded metadata** for video, audio and PDF items. CSV
items are parsed deterministically. The interface must label simulated extraction as such.

## Events (expected timeline)

Sorted by normalized time.

| Event  | Source locator          | Source time | Normalized time | Rule applied            | Claim state  |
| ------ | ----------------------- | ----------- | --------------- | ----------------------- | ------------ |
| EV-001 | E-05 · row 3            | 21:00:00    | 21:00:00        | none                    | Supported    |
| EV-009 | E-05 · row 7            | 21:09:00    | 21:09:00        | none                    | Contradicted |
| EV-011 | E-01 · timecode 00:14   | 21:10:00    | 21:10:00        | none                    | Supported    |
| EV-012 | E-04 · row 18           | 21:12:00    | 21:12:00        | none                    | Supported    |
| EV-014 | E-02 · timecode 00:39   | **21:16:00**| **21:14:00**    | offset −120 s (E-02)    | Supported    |
| EV-016 | E-03 · timecode 00:52   | 21:16:00    | 21:16:00        | none                    | Inferred     |
| EV-018 | E-06 · page 2, para 3   | ~21:18      | 21:16–21:20     | approximate window ±2 min | Unresolved |
| EV-020 | E-05 · row 12           | 22:00:00    | 22:00:00        | none                    | Supported    |

Which log rows become events: access-log rows inside the incident window (21:00–22:00), and
inventory rows inside the window that concern the case asset EQ-4471 or are door events.

The source time is never overwritten. Normalized time is a separate, derived field with the
rule that produced it.

## Conflicts (expected detector output)

| ID   | Rule          | Type                 | Severity | Evidence           | Explanation |
| ---- | ------------- | -------------------- | -------- | ------------------ | ----------- |
| C-01 | RULE-DUP-001  | Copied log record    | High     | E-04 r18, E-05 r7  | E-05 row 7 matches E-04 row 18 on badge, door and event code but is stamped 21:09:00, before the first person enters at 21:10:00. Possible copy or import error. **Not proof of tampering.** |
| C-02 | RULE-TIME-001 | Clock offset         | Medium   | E-02 (vs E-01, E-04) | E-02 clock runs 120 s fast. Source 21:16:00 normalizes to 21:14:00. In the demo the offset is declared in the fixture metadata; the UI must say so. |
| C-03 | RULE-CLAIM-001| Identity not established | Review | — (claim CL-04)    | The person in E-01 cannot be linked to badge B-117 from the available evidence. |

## Claims

| ID    | Statement                                                    | State        | Supporting      | Contradicting |
| ----- | ------------------------------------------------------------ | ------------ | --------------- | ------------- |
| CL-01 | The loading-bay door opened at 21:12:00                      | Supported    | E-04 r18        | —             |
| CL-02 | A trolley moved through the bay at 21:14:00                  | Supported    | E-02 (normalized) | —           |
| CL-03 | The 21:16 alarm came from the loading-bay door               | Inferred     | E-03, E-04      | —             |
| CL-04 | The person in E-01 is the holder of badge B-117               | Unresolved   | —               | —             |
| CL-05 | A separate door event happened at 21:09:00                   | Contradicted | E-05 r7         | E-04, E-01    |
| CL-06 | EQ-4471 was on the trolley                                   | Unresolved   | —               | —             |

### Claim state criteria

- **Supported** — at least one cited source directly records it, and no cited source conflicts.
- **Contradicted** — at least one cited source conflicts with it under a named rule.
- **Inferred** — it follows from two or more cited sources but no single source records it.
- **Unresolved** — the available sources cannot establish or rule it out.

## Hypotheses for C-01 — "Why does E-05 record a door event at 21:09:00?"

| ID   | Hypothesis                                 | State        | Notes |
| ---- | ------------------------------------------ | ------------ | ----- |
| H-01 | The copied row is an import artifact        | Inferred     | Field-for-field match except time; import job log not available |
| H-02 | The copied row was edited after export      | Unresolved   | E-05 has no edit history; cannot confirm or rule out |
| H-03 | A genuine second door event at 21:09        | Contradicted | E-04 has no 21:09 row; E-01 shows no entry before 21:10 |

No hypothesis gets a probability score. The product compares evidence; it does not pick a winner.

## Live update moment

During the demo the presenter adds **E-07, a gate camera export** (fictional). It shows no
vehicle leaving between 21:10 and 21:30. Expected change: CL-06 stays **Unresolved** and a new
note is added to H-01..H-03 that E-07 does not bear on C-01. The point is to show that new
evidence updates the case **and the system says honestly what did not change.**

## Acceptance checklist (used by tests)

- [ ] Exactly six evidence items after `reset`.
- [ ] EV-014 keeps source time 21:16:00 and shows normalized time 21:14:00.
- [ ] C-01 is detected by RULE-DUP-001 and links E-04 row 18 and E-05 row 7.
- [ ] C-02 is detected by RULE-TIME-001 and names E-02.
- [ ] No event is labeled with a person's identity.
- [ ] Every claim except Unresolved ones cites at least one evidence item.
- [ ] Reset returns the case to this exact state; running the engine twice gives identical output.
