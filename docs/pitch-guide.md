# Pitch guide

How the team presents Ghost Protocol to the judges: what changed in v2, who says what, the
five-minute run, and answers to the questions judges ask. The second-by-second demo script is
[demo-script.md](demo-script.md); this page is the plan around it.

| | |
| --- | --- |
| Live demo | https://ghost-protocol-demo.onrender.com |
| Pitch deck | shared by @Bolajiomo99 (13 slides, black and lime) |
| Repository | https://github.com/Ghost-Protocol-Team-1A/Ghost-Protocol |
| Design | Figma, section **v2 · Black + Lime** |

## What changed in v2

Know these before you present; judges will see them.

| Feature | Where | What to say |
| --- | --- | --- |
| **Clock offset inferred, not declared** | Conflicts → C-02 | Nobody told it the camera was wrong. It found two moments the camera shares with trusted clocks (bay door, alarm) and both say 120 s fast. Rule `RULE-TIME-002`. |
| **Source lanes** | Timeline (top panel) | Every source on one clock. A dashed ring shows where the camera's own clock put each event. |
| **Evidence graph** | Graph | Evidence → events → claims → conflicts. Point at C-01 and only the two compared rows stay lit. |
| **Guided demo** | Home → *Start guided demo* | Seven stops through the case, each one spotlighted. Any stop is a link. |
| **⌘K search** | Top bar, or press `/` | Jump to any conflict, event, evidence item, or download the report. |
| **Sign in with your name** | *Sign in* | A demo name, no password. Decisions appear under that name in the audit trail. |
| **Uploads** | Intake | 33 formats, including iPhone voice memos, videos and photos. Checked against their bytes, hashed and playable. |
| **Public site** | Home, Platform, Services, Why, Resources, White paper | All pages exist; the landing page timeline is drawn live from the engine. |

## Roles

A suggestion; swap as the team prefers, but decide before the day.

| Who | Part |
| --- | --- |
| @Bolajiomo99 | Opening, problem, close. Owns the laptop and the live demo. |
| @DANTE-1903 | Demo backup: wrote the demo script; takes over if the presenter stalls. |
| @Blessed-Femi | Q&A on audit trail, reviews and uploads. |
| @Aycode01 | Q&A on the blind case (proves nothing is hard-coded). |
| @Riel101 | Q&A on the report export. |
| @mallison031 | Q&A on upload checks and hashing. |
| @Orah-dev | Q&A on CI and how every change is tested. |
| @Waffiyyi | Q&A on pricing and who would buy it. |

## Before the pitch (T−10 minutes)

1. Open https://ghost-protocol-demo.onrender.com/healthz. It must say `"status":"ok"`. The free
   server can take up to a minute to wake; UptimeRobot normally keeps it awake.
2. Open the dashboard and press **Reset demo**. Conflicts should read 3 open, E-07 waiting.
3. Sign in as the presenter (any name, role Reviewer).
4. Open the deck in another tab. Zoom the browser to 110–125% for the room.
5. Have the local fallback ready (below) on a second machine if you can.

## The five-minute run

| Time | Slide or screen | Say |
| --- | --- | --- |
| 0:00 | Deck: cover, problem | One incident leaves video, logs on different clocks, audio and statements. Summaries erase the doubt. |
| 0:30 | Deck: answer | Ghost Protocol shows what the evidence supports, what contradicts it, and what is still unknown. It never names who did it. |
| 0:50 | Live: Home → **Start guided demo** | Let the tour drive. Stop 1: three things need a human decision. |
| 1:10 | Tour stop 2: source lanes | The camera's events moved back two minutes; the rings show where its clock put them. |
| 1:30 | Tour stop 3: C-02 | **The headline.** Nobody told it the camera was wrong; two anchors agree on 120 s. Both pairs are on screen. |
| 2:00 | Tour stop 4: C-01 | A copied log row stamped before anyone arrived. Flagged by a named rule; "not proof of tampering". |
| 2:20 | Tour stop 5: hypotheses | Three explanations, evidence for and against, no percentages. Record a decision with a reason. |
| 2:45 | Tour stop 6: add **E-07** | New evidence: it says what changed and, as importantly, what did not. |
| 3:15 | **Graph** (sidebar) | Point at C-01: only the two compared rows light up. |
| 3:35 | Tour stop 7: report | Both times, every rule, unresolved questions kept in the export. |
| 3:55 | Deck: proof, limits | 179 tests, identical results on repeated runs, a blind case. Be honest about the limits. |
| 4:30 | Deck: team, close | "Not another system telling you what happened, but one that shows you why." Invite them to try the link. |

If time is short, skip the Graph and the proof slide. Never skip C-02 or the E-07 moment.

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Site is slow or asleep | Keep talking over the deck slides for 30–60 s; reload. |
| Site is down | Switch to the local copy (below), or continue on the deck: every claim is on a slide. |
| State looks wrong (E-07 already added, decisions present) | Dashboard → **Reset demo**. |
| Tour card gets in the way | × closes it; navigate by the sidebar. |
| A page errors | ⌘K and jump to the page by name. |

Local fallback, from a fresh clone (about a minute; see the README). Then open http://localhost:3000:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]' && .venv/bin/uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm ci && npm run dev
```

## Questions judges ask

**Is this AI?** No model decides anything. The rules are fixed code with IDs; the same input gives
the same output every time. We ran it ten times and got identical results.

**How does it know the camera is two minutes fast?** It looks for moments the camera shares with
sources on a trusted clock: the bay door opening (also in the access log) and the alarm (also in
the alarm audio). Each pair gives an estimate; the median is the offset and the spread is kept.
Both pairs are shown. With no anchor, it moves nothing.

**Is the data real?** No. Every case is fictional and every screen says so.

**Does it accuse anyone?** Never. Identity stays Unresolved unless a source supports it, and a
copied record is "not proof of tampering".

**What is real and what is simulated?** Logs are parsed for real. In the demo case, video, audio
and PDF events come from metadata and are labeled simulated. Uploaded files are really checked,
hashed and playable, but events are not yet extracted from them.

**Why not just use a forensic suite?** They collect and index evidence at scale. We work on the
step after: aligning clocks, naming contradictions, and keeping uncertainty in the report.

**How is it tested?** 118 backend and 61 frontend tests run on every pull request, plus a blind
case written by a teammate with the answers fixed before the data.

**Is it secure?** It is a demo: sign-in is a name without a password and data is in memory.
Uploads are checked against their bytes, stored by hash, and served so they cannot run as pages.
What a real deployment needs is in [security.md](security.md).

**Who would pay for it?** Incident response, insurance and loss investigation, and workplace
safety teams: anyone who must explain what happened and defend it.

## Rules for the day

- Say "the evidence supports", "contradicts", "cannot tell". Never "proves who".
- Every number on a slide is from our own runs; do not round up or add new ones.
- If a judge asks something we have not built, say so and say how we would build it.
