import type { IconName } from "@/components/Icon";

export const CASE = "CASE-001";

export const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/cases", label: "Cases", icon: "cases" },
  { href: `/cases/${CASE}/timeline`, label: "Timeline", icon: "timeline" },
  { href: `/cases/${CASE}/graph`, label: "Graph", icon: "graph" },
  { href: `/cases/${CASE}/conflicts`, label: "Conflicts", icon: "conflicts" },
  { href: `/cases/${CASE}/hypotheses`, label: "Hypotheses", icon: "hypotheses" },
  { href: `/cases/${CASE}/evidence`, label: "Evidence", icon: "evidence" },
  { href: `/cases/${CASE}/intake`, label: "Intake", icon: "intake" },
  { href: `/cases/${CASE}/report`, label: "Report", icon: "report" },
  { href: `/cases/${CASE}/audit`, label: "Audit trail", icon: "audit" },
];
