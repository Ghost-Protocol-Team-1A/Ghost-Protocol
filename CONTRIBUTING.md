# Contributing to Ghost Protocol

Eight people build this project. These rules keep `main` working and make sure every
person's work is visible and credited to them.

## Team

| GitHub        | Owns                                                        |
| ------------- | ----------------------------------------------------------- |
| @Bolajiomo99  | Lead: architecture, evidence engine, workstation UI, design, integration |
| @Riel101      | Report export                                               |
| @mallison031  | Evidence upload checks                                      |
| @Aycode01     | Blind-test case                                             |
| @Blessed-Femi | Audit trail page                                            |
| @Waffiyyi     | Public pages: Contact and Pricing                           |
| @Orah-dev     | Continuous integration                                      |
| @DANTE-1903   | Demo script and evaluation                                  |

Each task has a GitHub issue with the exact scope, the files you may touch and the
acceptance criteria. See [docs/team-tasks.md](docs/team-tasks.md).

## The rules

1. **Work only on your own issue.** Open pull requests for your own task, not on someone
   else's behalf, and don't fold another person's work into yours. If you finish early, ask the
   lead for the next task.
2. **One branch per task**, named `<your-handle>/<short-task>`, for example
   `riel101/report-export`. Never commit directly to `main`.
3. **Small commits that each do one thing**, with a clear message:
   `feat(report): export markdown report`, `test(report): cover empty case`.
   Push as you go; don't hold everything back for one giant commit.
4. **Stay inside your files.** Your issue lists the paths you own. If you need to change a
   shared file (models, API contracts, design tokens), ask the lead first in the issue.
5. **Follow the scenario.** Demo data must match [docs/demo-scenario.md](docs/demo-scenario.md).
   Never use real names, real incidents or real personal data.
6. **No AI co-author credit.** Commits and pull request descriptions must not contain
   `Co-authored-by:` lines or "Generated with …" lines for Claude, ChatGPT, Copilot or any
   other AI tool. The **Contributor check** workflow fails the pull request if they do, and a
   failing pull request cannot be merged.
7. **No secrets.** Use `.env` locally (it is git-ignored); only `.env.example` with
   placeholders is committed.
8. **Respect the product rules:** never present an inference as a fact, never label a person
   as responsible, always keep the original timestamp next to any normalized one.

## Pull requests

- Fill in the template, including `Closes #<issue>` and the exact commands you ran.
- The **Contributor check** and the test workflow must pass.
- @Bolajiomo99 reviews and merges. Address review comments with new commits; don't
  force-push over someone else's commits.

## Keeping your branch up to date

`main` only accepts **Rebase and merge**, and GitHub cannot rebase a branch that contains a merge
commit. So **never** bring `main` into your branch with a merge:

- don't press GitHub's **Update branch** button on a pull request;
- don't run `git merge main` or `git pull origin main` on your branch.

Rebase instead, then push your own branch:

```bash
git fetch origin
git rebase origin/main            # fix any conflicts, then: git add <file> && git rebase --continue
cd backend && .venv/bin/pytest -q && cd ../frontend && npm test   # re-run checks
git push --force-with-lease       # only on your own branch
```

If your branch already has a merge commit, the same `git rebase origin/main` removes it.

## Fixing a failed Contributor check

If your editor or tool added an AI co-author line, rewrite the message and push again:

```bash
git rebase -i origin/main          # mark the commit as "reword", delete the line
git push --force-with-lease        # only on your own branch
```

## Local setup

Setup instructions live in the [README](README.md#running-locally). They will be filled in as
the scaffold lands.
