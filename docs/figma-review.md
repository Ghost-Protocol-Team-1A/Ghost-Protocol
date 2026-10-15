# Figma-to-implementation review

Compares every frame in the [Ghost Protocol design file](https://www.figma.com/design/3IWZQxgbsWBZuzPqPYVI2M/Untitled)
with what is built on `main`. Reviewed 2026-10-15 against the running app.

**Which one wins when they differ:** live data and `docs/demo-scenario.md` beat sample numbers
in Figma. Figma beats code for layout, color and interaction.

Legend: ✅ matches · ◐ built, with listed gaps · ✗ not built

## Workstation

| Frame | Status | Notes |
| --- | --- | --- |
| Case dashboard `48:78` | ◐ | Built with live data. Figma shows sample counts (04 cases, 24 items, "Processing 02", CASE-002/003) and "Audio still processing" — none of these exist in the demo. Built uses **Unresolved claims** instead of Processing (nothing is ever processing in the seeded demo) and adds the **Live demo** panel (E-07, reset), which Figma lacks. Global search box and avatar are not built. |
| Investigation timeline `48:1381` | ◐ **gap** | Built: chronological events with source and normalized time and claim-state badges. **Missing: filter bar (sources, claim state), selecting an event to show the detail panel, the conflict callout, and the claim-state legend.** These are brief acceptance criteria — next lead task. Built also shows EV-001 and EV-020 (secured/missing), which Figma omits. |
| Conflict inspector `48:257` | ✅ | Same structure and content. Built adds evidence integrity and review status. |
| Hypothesis comparison `48:795` | ◐ | Matches. Figma's "Compare evidence · Add reviewer note · Mark unresolved" actions are not built (needs `POST /api/reviews`, planned). |
| Evidence viewer `48:334` | ✅ | Updated in Figma to the canonical E-02. Built shows original CSV rows for logs, which Figma's video preview does not. |
| Report builder `48:413` | ◐ | Built matches the seven sections and status panel. Figma says export stays disabled until review passes; built allows export at any time and the report states human approval is pending. Figma's "18 / 18 sources linked" is sample data (built: 8 / 8 events linked). |
| Cases `48:638` | ◐ | Built with live data. Figma's status filter tabs (All, Active, Needs review…) and owner column are not built. CASE-002–005 in Figma are sample rows. |
| Create case `48:937` | ◐ | Built: title, description, incident window, UTC offset, validation. Figma's scope, data classification and per-source time assumptions are not built. |
| Audit trail `48:1056` | ✗ | Issue #5, @Blessed-Femi. Sidebar link currently 404s. |
| Evidence intake `48:163` | ✗ | Upload API is in PR #19 (pending). Upload screen is a lead task after it merges. |
| Extraction review `48:711` | ✗ | Out of MVP scope (extraction for media is simulated). |
| Team & permissions `48:851` | ✗ | Out of MVP scope (no authentication in the demo). |
| Settings & privacy `48:1478` | ✗ | Out of MVP scope. |
| Mobile review `48:1533` | ◐ | Every built screen fits 375 px with no sideways scroll (PR #21). The mobile-specific card layout in Figma is not built; the sidebar stacks above content. |
| Design system `48:1127` | ✅ | Tokens in `frontend/src/styles/tokens.css`; claim-state colors and labels match. |
| Product blueprint `48:1592` | ✅ | Pipeline, event contract and claim states match the built engine. |
| Team build map `48:1197` | ✅ | Matches the issues and owners. |

## Public site

| Frame | Status | Notes |
| --- | --- | --- |
| Brand board `70:2` | ✅ | Logo and palette used in code. |
| Landing `70:28` | ◐ | Built as a short home page with the tagline and a link to the workspace; the full landing layout is not built. |
| Contact `72:212`, Pricing `72:118` | ✗ | Issue #6, @Waffiyyi. |
| Sign in `72:256`, Registration `72:293` | ✗ | Out of MVP scope: no authentication in the demo, and a sign-in screen that does nothing would be a fake control. |
| Platform `72:406`, Services `72:358`, Why `72:479`, Resources `72:158`, White paper `72:522` | ✗ | Cut first if time runs short, per the build plan. |

## Actions

1. **Lead:** build the timeline filter bar, event detail panel, conflict callout and legend (closes the main acceptance gap).
2. **Lead (Figma):** replace sample counts on the dashboard, cases and report-status frames with the demo's real values so judges comparing design and app see the same story.
3. **@Blessed-Femi:** audit trail page (#5).
4. **@Waffiyyi:** Contact and Pricing (#6).
5. **Lead:** evidence intake screen after PR #19 merges.
