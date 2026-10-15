"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import styles from "./shell.module.css";

const CASE = "CASE-001";

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

/** True when the current path is this nav item (or a page under it, for /cases). */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/cases") return pathname === "/cases" || pathname === "/cases/new";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Logo href="/dashboard" />
      </div>
      <p className={styles.group}>Workspace</p>
      <nav aria-label="Workspace" className={styles.nav}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles.item}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.caseCard}>
        <p className="gp-mono">{CASE}</p>
        <p>Warehouse incident</p>
        <p className={styles.muted}>Fictional · synthetic</p>
      </div>
    </aside>
  );
}
