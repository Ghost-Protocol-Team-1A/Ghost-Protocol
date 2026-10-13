import type { Conflict } from "./types";

export const CONFLICT_TITLES: Record<Conflict["type"], string> = {
  copied_record: "Copied log out of sequence",
  clock_offset: "Camera clock offset",
  identity_not_established: "Identity not established",
};

export const SEVERITY_LABELS: Record<Conflict["severity"], string> = {
  high: "High",
  medium: "Medium",
  review: "Needs review",
};

/** "E-02 · Bay CCTV" style title for a conflict, naming its evidence when there is some. */
export function conflictTitle(c: Conflict): string {
  const base = CONFLICT_TITLES[c.type];
  return c.type === "clock_offset" && c.evidence_ids.length
    ? `${base} · ${c.evidence_ids.join(", ")}`
    : base;
}

/** Pick the conflict named in the URL, falling back to the first one. */
export function selectConflict(conflicts: Conflict[], wanted?: string): Conflict | undefined {
  return conflicts.find((c) => c.id === wanted) ?? conflicts[0];
}
