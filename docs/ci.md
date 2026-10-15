# Continuous integration

Workflow file: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
Owned by @Orah-dev (issue #7). Nothing else in CI is changed by this task; the
**Contributor check** workflow lives in its own file and is not touched here.

## What runs

| | `backend` job | `frontend` job |
| --- | --- | --- |
| Runs on | every pull request, every push to `main` | every pull request, every push to `main` |
| Runner | `ubuntu-latest`, Python **3.12** | `ubuntu-latest`, Node **22** |
| Install | `pip install -e ".[dev]"` in `backend/` | `npm ci` in `frontend/` |
| Checks | `ruff check .` then `pytest -q` | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Cache | pip (keyed on `backend/pyproject.toml`) | npm (keyed on `frontend/package-lock.json`) |

The two jobs are independent, so they start at the same time and run in parallel.
If any step in a job fails, the later steps of that job are skipped and the run is
red; the other job still runs to completion.

**A job is skipped when its folder did not change.** A `detect changes` job compares
the changed files against `backend/**` and `frontend/**`; only jobs whose folder was
touched run. Two exceptions:

- A change to `.github/workflows/ci.yml` itself runs **both** jobs, so the pipeline
  can always validate itself.
- A pull request that touches neither folder (for example a docs-only change) runs
  only `detect changes`; a fully skipped run counts as passing.

Pushes to `main` use the same rules. Concurrent runs on the same branch cancel
older ones, so only the newest commit of a pull request is tested.

## Run the same commands locally

These are exactly the commands CI runs. The backend and frontend checks are
independent; run them in two terminals if you like.

**Backend** (Python 3.12+, from the repository root):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/ruff check .
.venv/bin/pytest -q
```

**Frontend** (Node 22+, from the repository root):

```bash
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm ci`, not `npm install`, locally too: it installs exactly what
`package-lock.json` pins, which is what CI does. If a local check passes but fails
in CI, the versions differ first — check `git diff` on the lockfile.

## How to read a failure

1. **Open the run** from the pull request Checks tab (or the Actions tab on `main`)
   and click the red job. The green jobs can be ignored; a skipped job means that
   folder did not change.
2. **The failing step is the first red step in the job.** Steps after it did not
   run — fix the first failure before reading further, because later failures are
   usually consequences of it.
3. **Match the tool output to the fix:**

   | Step | Output tells you | Typical fix |
   | --- | --- | --- |
   | Ruff | `path/to/file.py:12:5: RULE_CODE message` | Fix the line, or run `.venv/bin/ruff check . --fix` for auto-fixable rules. |
   | Pytest | `FAILED tests/test_x.py::test_y` plus the assertion diff | Reproduce locally: `.venv/bin/pytest tests/test_x.py::test_y -q`, then read the diff between expected and actual. |
   | ESLint | `path/file.tsx line 8 col 3 error ...` | Fix the rule violation or restructure the code; do not blanket-disable rules. |
   | TypeScript | `error TS2345: ...` in `npm run typecheck` | Fix the types. The file and line are in the message. |
   | Vitest | `FAIL src/...test.ts` with the assertion diff | Reproduce locally: `npm test -- path/to/file.test.ts`. |
   | Next.js build | Route and error during `Generating static pages` or compilation | Run `npm run build` locally; the first error is the real one. |

4. **Backend and frontend fail independently.** A red `frontend` run never means
   the backend broke, and vice versa. If both are red, you probably changed a shared
   contract — that is lead territory, see [CONTRIBUTING.md](../CONTRIBUTING.md).
5. **Reruns:** after pushing a fix, the workflow starts a fresh run on your newest
   commit; old runs on previous commits stay red and are harmless. You can also
   rerun a failed run from its page, but a new push is the normal path.
6. **Nothing is mocked.** Tests hit the real seed data and engine, so a failure in
   CI should reproduce locally with the commands above. Demo data must stay
   fictional and match [demo-scenario.md](demo-scenario.md).

## Common red herrings

- **Everything skipped** — your change touched neither `backend/` nor `frontend/`
  nor the workflow file. That is a pass, not a bug.
- **CI fails but your machine passes** — almost always an unpinned dependency
  (`npm install` rewrote the lockfile) or a stale virtualenv. Commit the lockfile
  change deliberately or restore it.
- **The Contributor check fails** — that is a different workflow, about AI
  co-author lines in commit messages or the PR description; see
  [CONTRIBUTING.md](../CONTRIBUTING.md#fixing-a-failed-contributor-check).
