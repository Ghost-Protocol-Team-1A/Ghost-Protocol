import { NAV } from "@/features/shell/nav";
import { api } from "@/lib/api";
import { paletteItems } from "@/lib/palette";

const CASE_ID = "CASE-001";

/** Items for the command palette, built server-side so the browser never calls the API. */
export async function GET() {
  try {
    const [cases, conflicts, events, evidence, hypotheses] = await Promise.all([
      api.cases(),
      api.conflicts(CASE_ID),
      api.timeline(CASE_ID),
      api.evidence(CASE_ID),
      api.hypotheses(CASE_ID),
    ]);
    const items = paletteItems(CASE_ID, NAV, { cases, conflicts, events, evidence, hypotheses });
    return Response.json(items, { headers: { "cache-control": "no-store" } });
  } catch {
    // Pages and actions still work when the API is down.
    return Response.json(paletteItems(CASE_ID, NAV, { cases: [], conflicts: [], events: [], evidence: [], hypotheses: [] }), {
      headers: { "cache-control": "no-store" },
    });
  }
}
