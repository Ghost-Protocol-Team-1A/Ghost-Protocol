# Ghost Protocol — Evaluation & Acceptance Matrix

> **Purpose:**  
> This document formalizes the evaluation framework for Ghost Protocol. It turns the acceptance checklist from [docs/demo-scenario.md](demo-scenario.md) into an actionable verification matrix and defines standard protocols for usability, clean-machine deployment, and engine determinism.
>
> Rehearsals take place on **Day 6 (Hardening & Polish)** and **Day 7 (Final Rehearsal & Submission)**.

---

## 1. Master Acceptance Matrix

Columns:
- **Check**: What requirement is being validated.
- **How to verify**: Exact API endpoint, shell command, or UI inspection step.
- **Result**: `PASS`, `FAIL`, or `PENDING` (to be filled during rehearsals).
- **Date**: Evaluation execution date (`YYYY-MM-DD`).
- **Who**: GitHub handle of the evaluating teammate.

| Check | How to verify | Result | Date | Who |
| :--- | :--- | :--- | :--- | :--- |
| **01. Exactly six evidence items after reset** | 1. Send `POST /api/demo/reset`.<br>2. Call `GET /api/cases/CASE-001/evidence`.<br>3. Verify array length is exactly 6 (`E-01` through `E-06`).<br>4. Verify `E-07` is present in `GET /api/cases/CASE-001/staged`. | PASS | 2026-10-15 | @Bolajiomo99 |
| **02. EV-014 dual time display** | 1. Call `GET /api/cases/CASE-001/timeline`.<br>2. Find event `EV-014`.<br>3. Verify `source_time` is `2026-10-10T21:16:00+01:00`.<br>4. Verify `normalized_time` is `2026-10-10T20:14:00Z` (displayed as `21:14:00` local).<br>5. Verify `offset_seconds` is `120` (rule `offset -120 s`).<br>6. Check UI at `/cases/CASE-001/timeline` renders both values side-by-side. | PASS | 2026-10-15 | @Bolajiomo99 |
| **03. C-01 detected by RULE-DUP-001** | 1. Call `GET /api/cases/CASE-001/conflicts`.<br>2. Locate conflict `C-01`.<br>3. Verify `rule_id` equals `RULE-DUP-001`.<br>4. Verify linked evidence contains `E-04` (row 18) and `E-05` (row 7).<br>5. Verify explanation notes potential duplicate/import error and explicitly states **"Not proof of tampering"**.<br>6. Inspect UI at `/cases/CASE-001/conflicts?c=C-01`. | PASS | 2026-10-15 | @Bolajiomo99 |
| **04. C-02 detected by RULE-TIME-002** | 1. Call `GET /api/cases/CASE-001/conflicts`.<br>2. Locate conflict `C-02`.<br>3. Verify `rule_id` equals `RULE-TIME-002`.<br>4. Verify `evidence_ids` is `["E-02"]` and the explanation says it runs 120 s fast and lists both anchor pairs (EV-013/EV-012, EV-017/EV-016).<br>5. Verify the evidence viewer labels E-02's clock "inferred from anchors". | PASS | 2026-10-15 | @Bolajiomo99 |
| **05. Identity neutrality (no accusatory labeling)** | 1. Call `GET /api/cases/CASE-001/timeline` and `GET /api/cases/CASE-001/claims`.<br>2. Verify no person's name or identity is attached as responsible or guilty.<br>3. Verify claim `CL-04` ("The person in E-01 is the holder of badge B-117") remains in state `unresolved`.<br>4. Audit UI for any accusatory tone. | PASS | 2026-10-15 | @Bolajiomo99 |
| **06. Evidence citation integrity** | 1. Call `GET /api/cases/CASE-001/claims`.<br>2. Iterate through all claims (`CL-01` to `CL-06`).<br>3. Assert every claim whose state is NOT `unresolved` has at least 1 valid `evidence_links` citation with non-empty `locator`.<br>4. Assert `CL-04` and `CL-06` have empty citations and state `unresolved`. | PASS | 2026-10-15 | @Bolajiomo99 |
| **07. Reset idempotence** | 1. Trigger `POST /api/demo/reset`.<br>2. Dump JSON of `/timeline`, `/conflicts`, `/claims`, `/hypotheses`.<br>3. Trigger `POST /api/demo/reset` again.<br>4. Dump JSON again and run `diff -u`.<br>5. Assert 0 diff lines (bit-for-bit identical). | PASS | 2026-10-15 | @Bolajiomo99 |
| **08. Time for new viewer to find C-01 unaided** | 1. Present fresh subject with `/dashboard`.<br>2. Prompt: *"Find the high-severity conflict concerning duplicate records."*<br>3. Time duration using stopwatch until subject opens `/cases/CASE-001/conflicts?c=C-01`.<br>4. Target benchmark: **< 30 seconds**. | PENDING | 2026-10-15 | @DANTE-1903 |
| **09. Clean-machine setup time** | 1. Execute clean setup on a pristine environment (see Section 3).<br>2. Time execution from `git clone` to passing checks and loaded UI.<br>3. Target benchmark: **< 5 minutes (300 seconds)**. | PASS (≈61 s) | 2026-10-15 | @Bolajiomo99 |
| **10. Repeat-run engine determinism** | 1. Run determinism verification script (Section 4) executing 10 sequential engine evaluations without server restart.<br>2. Compute SHA-256 hash of serialized case output after each run.<br>3. Target benchmark: **10/10 identical hashes (0% variance)**. | PASS (10/10 identical) | 2026-10-15 | @Bolajiomo99 |

---

### Automated run, 2026-10-15

Checks 01–07 and 10 were run against `main` with an in-process API client; check 09 on a fresh
`git clone` following the README (backend set up and 102 tests passing in 25 s, frontend
installed, linted, type-checked, 29 tests and production build in 36 s). The fresh copy was then
started and the demo script's path checked page by page (28 checks, all passing, including the
live E-07 step and both report downloads). **Check 08 and the rehearsal runs need people and a
stopwatch and are still pending.**

## 2. Protocol: Unaided Discovery of C-01 (Check 08)

### Objective
Measure the visual hierarchy, contrast, and cognitive clarity of the workstation by observing how quickly a user unfamiliar with CASE-001 can locate and inspect conflict `C-01`.

### Participant Criteria
- Reviewer, teammate from another track (e.g. public pages or CI), or external volunteer.
- Must not have memorized the CASE-001 DOM layout.

### Test Procedure
1. Tester opens Chrome in incognito mode at `http://localhost:3000/dashboard`.
2. Evaluator provides the prompt:  
   > *"A duplicate row was detected between our access log and inventory log. Please find this conflict and show me the source records compared."*
3. Evaluator starts the timer on the first mouse movement.
4. Participant may click any dashboard card, link, or navigation item.
5. Timer stops when the participant lands on `/cases/CASE-001/conflicts?c=C-01` and views the comparison table.
6. Record elapsed time in the rehearsal log.

### Evaluation Criteria
- **Pass (Green):** $\le 30$ seconds.
- **Acceptable (Yellow):** $31$ to $60$ seconds.
- **Fail (Red):** $> 60$ seconds, or participant requires verbal guidance.

---

## 3. Protocol: Clean-Machine Setup Time (Check 09)

### Objective
Verify that a new developer or hackathon judge can clone the repository on a fresh machine (or clean Docker container) and achieve fully functioning backend and frontend services within 5 minutes.

### Standard Test Script
Run from a pristine shell directory:

```bash
#!/usr/bin/env bash
set -e
START_TIME=$(date +%s)

echo "=== 1. Cloning repository ==="
git clone https://github.com/Ghost-Protocol/Ghost-Protocol.git test-rig
cd test-rig

echo "=== 2. Backend setup ==="
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
ruff check .
pytest -q
cd ..

echo "=== 3. Frontend setup ==="
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
cd ..

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
echo "Total setup time: ${ELAPSED} seconds"

if [ $ELAPSED -le 300 ]; then
  echo "RESULT: PASS (${ELAPSED}s <= 300s)"
else
  echo "RESULT: FAIL (${ELAPSED}s > 300s)"
fi
```

### Evaluation Criteria
- **Pass:** $\le 300$ seconds (5 minutes) total setup time with all tests passing.
- **Fail:** $> 300$ seconds or any test/build step errors.

---

## 4. Protocol: Repeat-Run Determinism (Check 10)

### Objective
Show that the Ghost Protocol evidence engine is deterministic for the same inputs, producing identical normalization, conflict detection, and claim synthesis across repeated executions without state leakage or non-deterministic ordering.

### Test Script
Save as `verify_determinism.py` and run against the live API:

```python
import hashlib
import json
import urllib.request

BASE_URL = "http://localhost:8000"
ITERATIONS = 10
hashes = []

print(f"Running {ITERATIONS} determinism trials...")

for i in range(1, ITERATIONS + 1):
    # 1. Reset state
    req_reset = urllib.request.Request(f"{BASE_URL}/api/demo/reset", data=b"", method="POST")
    urllib.request.urlopen(req_reset)

    # 2. Collect core payloads
    endpoints = [
        "/api/cases/CASE-001",
        "/api/cases/CASE-001/evidence",
        "/api/cases/CASE-001/timeline",
        "/api/cases/CASE-001/conflicts",
        "/api/cases/CASE-001/claims",
        "/api/cases/CASE-001/hypotheses",
    ]
    
    combined = {}
    for ep in endpoints:
        with urllib.request.urlopen(f"{BASE_URL}{ep}") as resp:
            combined[ep] = json.loads(resp.read().decode("utf-8"))
    
    # 3. Canonical JSON serialization (sorted keys)
    serialized = json.dumps(combined, sort_keys=True).encode("utf-8")
    run_hash = hashlib.sha256(serialized).hexdigest()
    hashes.append(run_hash)
    print(f"  Iteration {i:02d}: SHA-256 = {run_hash}")

# Check variance
unique_hashes = set(hashes)
if len(unique_hashes) == 1:
    print(f"\n[DETERMINISM PASS] All {ITERATIONS} runs produced identical hash: {hashes[0]}")
else:
    print(f"\n[DETERMINISM FAIL] Found {len(unique_hashes)} divergent output states!")
    exit(1)
```

### Evaluation Criteria
- **Pass:** All 10 hashes match identical string value.
- **Fail:** Any divergence in hash values.

---

## 5. Rehearsal Execution Log

### Day 6: Hardening & Polish Run (Target: 2026-10-15)

*Pre-demo dry runs to catch UI glitches, slow endpoints, and copy discrepancies.*

| Trial # | Presenter / Tester | C-01 Discovery Time | Clean Setup Time | Master Matrix (Checks 01–07, 10) | Notes & Action Items | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Run 1** | @DANTE-1903 / @mallison031 | _s | _s | Pending | Dry run 1: baseline timing | PENDING |
| **Run 2** | @DANTE-1903 / @Blessed-Femi | _s | _s | Pending | Dry run 2: testing fallback procedures | PENDING |
| **Run 3** | @DANTE-1903 / @Bolajiomo99 | _s | _s | Pending | Dry run 3: full 3-minute stopwatch check | PENDING |

---

### Day 7: Final Rehearsal & Sign-Off (Target: 2026-10-16)

*Three consecutive flawless end-to-end runs required prior to submission.*

| Submission Trial | Presenter | Timed Demo Duration | Master Checklist | Live E-07 Ingestion | Sign-Off Lead | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Final Run 1** | @DANTE-1903 | _ | _ | Pending | @Bolajiomo99 | PENDING |
| **Final Run 2** | @DANTE-1903 | _ | _ | Pending | @Bolajiomo99 | PENDING |
| **Final Run 3** | @DANTE-1903 | _ | _ | Pending | @Bolajiomo99 | PENDING |

---

## 6. Failure Escalation Guide

If any check fails during Day 6 or Day 7 rehearsals, follow this decision tree:

1. **Check 01 or 07 fails (Reset/Seed Drift):**
   - Immediate contact: Lead (@Bolajiomo99).
   - Verify `backend/app/seed/case_001/case.json` against `docs/demo-scenario.md`.
2. **Check 02, 03, or 04 fails (Rule/Timeline Inconsistency):**
   - Immediate contact: Lead (@Bolajiomo99).
   - Check normalization in `backend/app/services/normalize.py` and rules in `backend/app/services/rules.py`.
3. **Check 05 or 06 fails (Claim or Identity Violation):**
   - Check frontend formatting in `frontend/src/lib/labels.ts` and `frontend/src/app/(workstation)/cases/[caseId]/`.
4. **Check 08 fails (Unaided Discovery > 30s):**
   - Review `/dashboard` link styling and badge prominence in `dashboard.module.css`.
5. **Check 09 fails (Clean Setup > 300s):**
   - Check lockfile churn in `package-lock.json` and pip cache flags in `backend/pyproject.toml`.
