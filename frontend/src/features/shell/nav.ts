import type { IconName } from "@/components/Icon";

/** The demo case, used when a page is not inside a case. */
export const CASE = "CASE-001";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const WORKSPACE: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/cases", label: "Cases", icon: "cases" },
];

/** A case's pages, in the order work happens: build the record, analyse it, decide. */
export function caseNav(caseId: string): NavGroup[] {
  const c = `/cases/${caseId}`;
  return [
    {
      label: "Build",
      items: [
        { href: c, label: "Overview", icon: "overview" },
        { href: `${c}/intake`, label: "Intake", icon: "intake" },
        { href: `${c}/extract`, label: "Extract", icon: "extract" },
        { href: `${c}/evidence`, label: "Evidence", icon: "evidence" },
      ],
    },
    {
      label: "Analyse",
      items: [
        { href: `${c}/timeline`, label: "Timeline", icon: "timeline" },
        { href: `${c}/graph`, label: "Graph", icon: "graph" },
        { href: `${c}/analytics`, label: "Analytics", icon: "analytics" },
        { href: `${c}/assistant`, label: "AI assistant", icon: "ai" },
        { href: `${c}/conflicts`, label: "Conflicts", icon: "conflicts" },
        { href: `${c}/hypotheses`, label: "Hypotheses", icon: "hypotheses" },
      ],
    },
    {
      label: "Decide",
      items: [
        { href: `${c}/questions`, label: "Questions & claims", icon: "questions" },
        { href: `${c}/conclusion`, label: "Conclusion", icon: "conclusion" },
        { href: `${c}/report`, label: "Report", icon: "report" },
        { href: `${c}/audit`, label: "Audit trail", icon: "audit" },
      ],
    },
  ];
}

/** Every workstation page for the demo case, flat: used by search and route checks. */
export const NAV: NavItem[] = [...WORKSPACE, ...caseNav(CASE).flatMap((g) => g.items)];

/** The case a path belongs to, if any: "/cases/CASE-004/timeline" -> "CASE-004". */
export function caseOf(pathname: string): string | null {
  return /^\/cases\/(CASE-\d{3})(\/|$)/.exec(pathname)?.[1] ?? null;
}
