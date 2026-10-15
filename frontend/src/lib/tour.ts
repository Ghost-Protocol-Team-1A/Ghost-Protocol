/** The guided demo: seven stops through CASE-001, driven by `?tour=N` in the URL. */

export interface TourStep {
  path: string;
  /** Extra query parameters for the page, without `tour`. */
  query?: Record<string, string>;
  /** CSS selector of the element to spotlight; skipped if it is not on the page. */
  target?: string;
  title: string;
  body: string;
}

const CASE = "/cases/CASE-001";

export const TOUR: TourStep[] = [
  {
    path: "/dashboard",
    target: '[aria-labelledby="decide-heading"]',
    title: "A fictional warehouse incident",
    body: "Asset EQ-4471 was recorded as secured at 21:00 and missing at 22:00. Six sources disagree about what happened in between. The engine found three things that need a human decision.",
  },
  {
    path: `${CASE}/timeline`,
    target: '[aria-labelledby="lanes-heading"]',
    title: "Every source on one clock",
    body: "One lane per source. The loading-bay camera’s events moved back two minutes; the dashed rings show where its own clock put them. Original times are never overwritten.",
  },
  {
    path: `${CASE}/conflicts`,
    query: { c: "C-02" },
    target: '[aria-labelledby="conflict-heading"]',
    title: "Nobody told it the camera was wrong",
    body: "RULE-TIME-002 found two moments the camera shares with trusted clocks: the bay door, also in the access log, and the alarm, also in the alarm audio. Both say 120 s fast. Each pair is listed so you can check it.",
  },
  {
    path: `${CASE}/conflicts`,
    query: { c: "C-01" },
    target: '[aria-labelledby="conflict-heading"]',
    title: "A copied record, not an accusation",
    body: "The inventory log repeats the access-log row for the bay door, stamped 21:09 instead of 21:12. RULE-DUP-001 flags it as a possible copy or import error and says plainly that it is not proof of tampering.",
  },
  {
    path: `${CASE}/hypotheses`,
    query: { c: "C-01" },
    target: "main article",
    title: "Explanations compared, not scored",
    body: "Three explanations for the 21:09 row, each with the evidence for and against. No percentages. A reviewer records a decision with a reason, and it lands in the audit trail under their name.",
  },
  {
    path: "/dashboard",
    target: '[aria-labelledby="live-heading"]',
    title: "New evidence, honestly",
    body: "Add E-07, a camera report held back from the seed. The summary shows what changed and, just as important, what did not.",
  },
  {
    path: `${CASE}/report`,
    target: '[aria-labelledby="status-heading"]',
    title: "A report that keeps the doubt",
    body: "Both times for every event, the rule behind every conflict, the hypotheses and the unresolved questions all go into the export. That is the whole loop: evidence in, uncertainty kept, people decide.",
  },
];

/** Parse `?tour=` into a step index, or null when the tour is not running. */
export function tourIndex(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= TOUR.length ? n - 1 : null;
}

/** URL for step `index` (0-based). */
export function tourHref(index: number): string {
  const step = TOUR[index];
  const params = new URLSearchParams({ ...step.query, tour: String(index + 1) });
  return `${step.path}?${params}`;
}
