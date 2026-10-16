"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { CASE, caseNav, caseOf, NAV, WORKSPACE } from "./nav";
import styles from "./shell.module.css";

export { NAV };

const LAST_CASE = "gp:last-case";

/** True when the current path is this nav item (or a page under it). Overview matches exactly. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/cases") return pathname === "/cases" || pathname === "/cases/new";
  if (/^\/cases\/CASE-\d{3}$/.test(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ titles = {} }: { titles?: Record<string, string> }) {
  const pathname = usePathname() ?? "";
  const here = caseOf(pathname);
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (here) localStorage.setItem(LAST_CASE, here);
      else setRemembered(localStorage.getItem(LAST_CASE));
    } catch {
      // Storage can be unavailable (private mode); the demo case is the fallback.
    }
  }, [here]);

  const caseId = here ?? remembered ?? CASE;
  const link = (item: { href: string; label: string; icon: string }) => (
    <Link
      key={item.href}
      href={item.href}
      className={styles.item}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Logo href="/" />
      </div>
      <nav aria-label="Workspace" className={styles.nav}>
        <p className={styles.group}>Workspace</p>
        {WORKSPACE.map(link)}
        {link({ href: "/guide", label: "Guide", icon: "guide" })}
      </nav>
      <nav aria-label={`Case ${caseId}`} className={styles.nav}>
        <Link href={`/cases/${caseId}`} className={styles.caseCard}>
          <span className="gp-mono">{caseId}</span>
          <span className={styles.caseTitle}>{titles[caseId] ?? "Open case"}</span>
        </Link>
        {caseNav(caseId).map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <p className={styles.group}>{group.label}</p>
            {group.items.map(link)}
          </div>
        ))}
      </nav>
      <Link href="/" className={styles.home}>
        <span className={styles.back} aria-hidden="true">
          <Icon name="arrow" size={14} />
        </span>
        Back to website
      </Link>
    </aside>
  );
}
