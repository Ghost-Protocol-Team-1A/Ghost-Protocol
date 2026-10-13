# Team tasks

Each teammate owns **one** task below. Every task has its own GitHub issue, branch and pull
request. Read [CONTRIBUTING.md](../CONTRIBUTING.md) and
[docs/demo-scenario.md](demo-scenario.md) before starting.

The lead (@Bolajiomo99) owns the core: architecture, domain model, evidence ingestion, time
normalization, conflict rules, claims and hypotheses, the API, the workstation screens
(dashboard, cases, timeline, evidence viewer, conflict inspector, hypothesis comparison,
report builder), all Figma design, and final integration. Tasks below plug into that core
through the contracts named in each task.

**Everyone starts now.** The skeleton is on `main`: the shared models
(`backend/app/models/domain.py`, `frontend/src/lib/types.ts`), the live read API for CASE-001,
the design tokens, and a placeholder file for every task below. You fill in your own files; you
never need to wait for another teammate.

### How we avoid conflicts

- **Separate files.** Each task owns the paths listed under it. Two people never edit the same file.
- **Contracts are frozen.** `domain.py`, `types.ts`, `tokens.css` and the API routes in `cases.py` change only through the lead. If you need a field, ask in your issue; the lead adds it to `main` the same day.
- **Short-lived branches.** Branch from the latest `main`, open a draft PR on your first push, and keep it open while you work. Before asking for review: `git fetch origin && git rebase origin/main`.
- **Pull `main` every morning.** That keeps everyone's copy close to everyone else's.
- **Code tasks run against the real API.** Start the backend locally (see README → Running locally). Nothing needs mocking.

---

## 1. Report export — @Riel101

**Branch:** `riel101/report-export`
**Start:** now. Placeholder: `backend/app/api/routes/report.py` returns 501 until you replace it.

Build the investigation report as a downloadable file, in Markdown and JSON.

**You own these paths**
- `backend/app/report/` (new: `builder.py`, `markdown.py`)
- `backend/app/api/routes/report.py`
- `backend/tests/test_report.py`

**What to build**
- `GET /api/cases/{case_id}/report?format=md|json` returning a file download
  (`Content-Disposition: attachment`).
- Sections in this order (they match Figma frame `48:413`, Report builder):
  1. Scope and case context, including the incident window
  2. Evidence inventory: ID, item, type, SHA-256, ingestion time
  3. Reconstructed timeline: **source time and normalized time side by side**, the rule applied, the claim state, the source locator
  4. Conflicts and rules: ID, rule ID, evidence involved, explanation
  5. Alternative hypotheses with their state
  6. Unresolved questions (every Unresolved claim)
  7. Methods and limitations, including "extraction for video, audio and PDF is simulated in this demo"
- A fixed notice at the top: *"Investigative aid only. This report does not determine
  responsibility or guilt. All data is fictional."*
- `generated_at` in UTC ISO-8601.

**Acceptance criteria**
- [ ] For CASE-001 the report lists all six evidence items, EV-014 shows `21:16:00 → 21:14:00`, and C-01/C-02 appear with `RULE-DUP-001`/`RULE-TIME-001`.
- [ ] No claim is dropped. Contradicted and Unresolved claims appear, not only Supported ones.
- [ ] Two calls give identical output apart from `generated_at`.
- [ ] Unknown case → `404`; unsupported format → `422`; both use the shared error shape.
- [ ] At least 6 pytest tests, all passing.

**Out of scope:** PDF export, the report builder screen (lead), changing domain models.

---

## 2. Evidence upload checks — @mallison031

**Branch:** `mallison031/upload-validation`
**Start:** now. Signatures to implement are in `backend/app/storage/hashing.py` and `validation.py`.

Make evidence upload safe and provable: validate files, hash the original bytes, never trust the
filename.

**You own these paths**
- `backend/app/storage/validation.py`
- `backend/app/storage/hashing.py`
- `backend/tests/test_upload_validation.py`

**What to build**
- Allow-list by extension **and** detected type: `mp4, wav, mp3, csv, json, pdf, txt, png, jpg`.
- Maximum size from `MAX_UPLOAD_MB` (default 50). Reject empty files.
- SHA-256 computed while streaming in chunks, so the whole file is never held in memory.
- Store files by hash (`<storage>/<sha256[:2]>/<sha256>`), never by the user's filename. Keep
  the original filename only as metadata, after cleaning: strip directories, remove control
  characters, limit to 120 characters.
- Same bytes uploaded twice → return the existing evidence item with `duplicate: true` instead
  of creating a second one.
- Errors: `413` too large, `415` type not allowed or type mismatch, `422` empty or invalid.

**Acceptance criteria**
- [ ] Tests cover: `../../etc/passwd` filename, `.exe` renamed to `.pdf`, oversize, empty file, the same file twice, and a valid CSV.
- [ ] The hash in the API response matches `shasum -a 256` of the file.
- [ ] No user-supplied text ever becomes part of a filesystem path.
- [ ] All tests pass.

**Out of scope:** the intake screen, extraction, cloud storage.

---

## 3. Blind-test case — @Aycode01

**Branch:** `aycode01/blind-test-case`
**Start:** now. Copy the layout of `backend/app/seed/case_001/` (a `case.json` plus CSV files) into `backend/app/seed/case_002/`.

Prove the engine works on a case it was not built around.

**You own these paths**
- `docs/blind-test.md`
- `backend/app/seed/case_002/` (`case.json` + CSV files)
- `backend/tests/test_blind_case.py`

**What to build**
1. **First commit:** write `docs/blind-test.md`, a fictional "server room access review" with five
   evidence items, and **write the expected answers before running anything**:
   - one source whose clock is **90 s slow** (normalized = source **+** 90 s);
   - one row copied between two logs with a different timestamp;
   - one approximate witness time.
2. Second commit: encode it in `backend/app/seed/case_002/` in the same format as CASE-001.
3. Third commit: tests that load it with `CaseData("case_002")`, run the engine and compare against your expected
   answers.

**Acceptance criteria**
- [ ] The commit history shows expected answers written before the fixture and tests.
- [ ] Tests check: the offset direction and size, the duplicate pair, and that the approximate time is Unresolved.
- [ ] You do **not** edit engine code. If the engine gets something wrong, leave that test failing with a clear message, mark it `xfail` with a reason, and open an issue describing the gap.
- [ ] All data is fictional.

---

## 4. Audit trail page — @Blessed-Femi

**Branch:** `blessed-femi/audit-trail-page`
**Start:** now. Data: `api.audit(caseId)` in `frontend/src/lib/api.ts`; the live endpoint is `GET /api/cases/CASE-001/audit`.

**You own these paths**
- `frontend/src/app/(workstation)/cases/[caseId]/audit/page.tsx`
- `frontend/src/features/audit/` (components and tests)

**What to build** (match Figma frame `48:1056`, Audit trail)
- A table of audit events: time, actor, action, entity, details. Newest first.
- Filters for actor, action and entity type that work together.
- Entity IDs link to their screen: `E-xx` → evidence viewer, `C-xx` → conflict inspector,
  `EV-xxx` → timeline with that event selected.
- Loading, empty ("No audit events match these filters") and error states.
- Use the shared table and badge components and design tokens. No new colors.

**Acceptance criteria**
- [ ] Works with real API data; no hard-coded rows in the page.
- [ ] Keyboard users can reach every filter and link; the table uses real `<table>` markup.
- [ ] Component tests: renders rows from a fixture, filtering reduces rows, error state shows.
- [ ] Usable at 390 px wide (rows become stacked cards).

---

## 5. Public pages: Contact and Pricing — @Waffiyyi

**Branch:** `waffiyyi/contact-pricing`
**Start:** now. The site header, footer and tokens are in `frontend/src/app/(site)/layout.tsx` and `frontend/src/styles/tokens.css`.

**You own these paths**
- `frontend/src/app/(site)/contact/page.tsx`
- `frontend/src/app/(site)/pricing/page.tsx`
- `frontend/src/features/site/contact-form.tsx` (+ test)

**What to build**
- **Contact** from Figma frame `72:212`. Form fields: name, email, organization, message
  (20–2000 characters). Validate in the browser with clear messages. The demo has no mail
  backend, so on submit show *"This demo doesn't send messages. Email the team at the address
  in the README."* Do not pretend the message was sent.
- **Pricing** from Figma frame `72:118`. Add a visible line: *"Illustrative tiers for the
  hackathon. Not a commercial offer."*
- Both pages use the shared header and footer with the Ghost Protocol logo.

**Acceptance criteria**
- [ ] Matches the Figma frames in layout, type and color (tokens only).
- [ ] Usable at 390 px and 1440 px with no horizontal scroll.
- [ ] Form test: empty submit shows errors; a valid submit shows the honest notice.
- [ ] Linked from the site navigation.

---

## 6. Continuous integration — @Orah-dev

**Branch:** `orah-dev/ci`
**Start:** now. The exact commands to run are in README → Running locally → Checks.

**You own these paths**
- `.github/workflows/ci.yml`
- `docs/ci.md`

**What to build**
- A workflow that runs on every pull request and on pushes to `main`:
  - **backend:** Python 3.12, install `backend` with dev dependencies, `ruff check`, `pytest`.
  - **frontend:** Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Cache pip and npm. Run the backend and frontend jobs in parallel. Skip a job when its folder
  did not change.
- `docs/ci.md`: what runs, how to run the same commands locally, how to read a failure.

**Acceptance criteria**
- [ ] The workflow passes on your pull request.
- [ ] In your PR description, link a run where you temporarily broke a test and CI went red, then fixed it.
- [ ] Do not modify `contributor-check.yml`.

---

## 7. Demo script and evaluation — @DANTE-1903

**Branch:** `dante-1903/demo-and-evaluation`
**Start:** now.

**You own these paths**
- `docs/demo-script.md`
- `docs/evaluation.md`
- `docs/competitors.md`

**What to build**
- **Demo script (3 minutes):** what the presenter says and clicks, second by second: the problem →
  open CASE-001 → timeline with source and normalized time → C-02 camera offset → C-01 copied
  log → hypotheses → add E-07 live → export report → close. Include a fallback line for every
  step that could fail live.
- **Evaluation:** turn the acceptance checklist in `demo-scenario.md` into a pass/fail table
  with columns *check, how to verify, result, date, who*. Add: time for a new viewer to find
  C-01 unaided; clean-machine setup time; repeat-run determinism.
- **Competitors and name check:** Cellebrite, Magnet AXIOM, the open-source Incident Lens
  project, and GhostLogic (a similar name in the same space). For each: what they verifiably
  do, with a link, and how Ghost Protocol differs. Say plainly where they are stronger.
  Recommend whether to keep the name.

**Acceptance criteria**
- [ ] Every competitor claim has a source link. No market-size or accuracy claims without a source.
- [ ] The script matches the scenario's IDs and times exactly.
- [ ] The evaluation table is ready to fill in during rehearsals on Day 6–7.
