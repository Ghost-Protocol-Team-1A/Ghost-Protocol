"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { CASE, NAV } from "./nav";
import styles from "./shell.module.css";

export { NAV };

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
