import type { CaseSummary, Conflict, EvidenceItem, Hypothesis, TimelineEvent } from "./types";

export type PaletteGroup = "Go to" | "Actions" | "Conflicts" | "Events" | "Evidence" | "Hypotheses" | "Cases";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  hint: string;
  href: string;
  /** Opens outside the app shell, e.g. a file download. */
  download?: boolean;
}

const GROUP_ORDER: PaletteGroup[] = ["Go to", "Actions", "Conflicts", "Events", "Evidence", "Hypotheses", "Cases"];

/** Everything the palette can jump to for one case. Built on the server from API data. */
export function paletteItems(
  caseId: string,
  pages: { href: string; label: string }[],
  data: {
    cases: CaseSummary[];
    conflicts: Conflict[];
    events: TimelineEvent[];
    evidence: EvidenceItem[];
    hypotheses: Hypothesis[];
  },
): PaletteItem[] {
  const base = `/cases/${caseId}`;
  return [
    ...pages.map((p) => ({ id: `page:${p.href}`, group: "Go to" as const, label: p.label, hint: "Page", href: p.href })),
    { id: "action:tour", group: "Actions", label: "Start guided demo", hint: "7 stops", href: "/dashboard?tour=1" },
    { id: "action:new", group: "Actions", label: "Create case", hint: "New", href: "/cases/new" },
    { id: "action:md", group: "Actions", label: "Download report (Markdown)", hint: caseId, href: `${base}/report/download?format=md`, download: true },
    { id: "action:json", group: "Actions", label: "Download report (JSON)", hint: caseId, href: `${base}/report/download?format=json`, download: true },
    { id: "action:signin", group: "Actions", label: "Change who is signed in", hint: "Demo identity", href: "/signin" },
    ...data.conflicts.map((c) => ({
      id: c.id,
      group: "Conflicts" as const,
      label: `${c.id} · ${c.rule_id}`,
      hint: c.status.replace("_", " "),
      href: `${base}/conflicts?c=${c.id}`,
    })),
    ...data.events.map((e) => ({
      id: e.id,
      group: "Events" as const,
      label: `${e.id} · ${e.description}`,
      hint: e.evidence_id,
      href: `${base}/timeline?ev=${e.id}`,
    })),
    ...data.evidence.map((e) => ({
      id: e.id,
      group: "Evidence" as const,
      label: `${e.id} · ${e.source_name}`,
      hint: e.original_filename,
      href: `${base}/evidence?e=${e.id}`,
    })),
    ...data.hypotheses.map((h) => ({
      id: h.id,
      group: "Hypotheses" as const,
      label: `${h.id} · ${h.description}`,
      hint: h.conflict_id ?? "",
      href: `${base}/hypotheses?c=${h.conflict_id ?? ""}`,
    })),
    ...data.cases.map((c) => ({
      id: `case:${c.case.id}`,
      group: "Cases" as const,
      label: `${c.case.id} · ${c.case.title}`,
      hint: c.case.status,
      href: `/cases/${c.case.id}/timeline`,
    })),
  ];
}

function score(item: PaletteItem, terms: string[]): number {
  const label = item.label.toLowerCase();
  const hay = `${label} ${item.hint.toLowerCase()} ${item.group.toLowerCase()}`;
  let total = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return 0;
    if (item.id.toLowerCase() === t) total += 100;
    else if (label.startsWith(t)) total += 20;
    else if (label.includes(` ${t}`)) total += 10;
    else total += 1;
  }
  return total;
}

/**
 * Filter and rank items for a query. Every word must match somewhere; exact IDs come first,
 * then label prefixes, then word starts. With no query, pages and actions are shown.
 */
export function rankItems(items: PaletteItem[], query: string, limit = 12): PaletteItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items.filter((i) => i.group === "Go to" || i.group === "Actions").slice(0, limit);
  return items
    .map((item, i) => ({ item, i, s: score(item, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}
