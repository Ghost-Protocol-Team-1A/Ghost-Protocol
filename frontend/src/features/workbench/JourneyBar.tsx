"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Journey } from "@/lib/types";
import styles from "./journey.module.css";

/** Pages of a case in the order the work flows, for the Back / Continue row. */
export function flow(caseId: string): { href: string; label: string }[] {
  const c = `/cases/${caseId}`;
  return [
    { href: c, label: "Overview" },
    { href: `${c}/intake`, label: "Intake" },
    { href: `${c}/extract`, label: "Extract" },
    { href: `${c}/evidence`, label: "Evidence & clocks" },
    { href: `${c}/timeline`, label: "Timeline" },
    { href: `${c}/conflicts`, label: "Conflicts" },
    { href: `${c}/questions`, label: "Questions & claims" },
    { href: `${c}/conclusion`, label: "Conclusion" },
    { href: `${c}/report`, label: "Report" },
  ];
}

/** Where a path sits in the flow; pages outside it (graph, analytics…) map to none. */
export function flowIndex(pathname: string, caseId: string): number {
  const pages = flow(caseId);
  const exact = pages.findIndex((p) => p.href === pathname);
  if (exact >= 0) return exact;
  return pages.findIndex((p, i) => i > 0 && pathname.startsWith(`${p.href}/`));
}

export function JourneyBar({ journey }: { journey: Journey }) {
  const pathname = usePathname() ?? "";
  const overview = `/cases/${journey.case_id}`;
  if (pathname === overview) return null; // the overview shows the full tracker
  const nextHere = journey.next_href.split("?")[0] === pathname;
  return (
    <nav aria-label="Case progress" className={styles.bar}>
      <ol className={styles.pills}>
        <li className={`gp-mono ${styles.id}`}>
          <Link href={overview}>{journey.case_id}</Link>
        </li>
        {journey.steps.map((s, i) => {
          const state = s.done ? styles.done : s.key === journey.current ? styles.now : "";
          return (
            <li key={s.key}>
              <Link href={s.href} className={`${styles.pill} ${state}`} title={s.detail} aria-current={s.key === journey.current ? "step" : undefined}>
                <span className={styles.num} aria-hidden="true">
                  {s.done ? "✓" : i + 1}
                </span>
                {s.label}
                <span className="sr-only">{s.done ? " (done)" : ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className={styles.next}>
        <span className={styles.detail}>{journey.next_detail}</span>
        {nextHere ? (
          <span className={styles.here}>You are on the next step</span>
        ) : (
          <Link href={journey.next_href} className="gp-btn gp-btn-lime">
            Next: {journey.next_label} →
          </Link>
        )}
      </div>
    </nav>
  );
}

export function PageFlow({ caseId }: { caseId: string }) {
  const pathname = usePathname() ?? "";
  const pages = flow(caseId);
  const i = flowIndex(pathname, caseId);
  if (i < 0) return null;
  const prev = pages[i - 1];
  const next = pages[i + 1];
  return (
    <nav aria-label="Page flow" className={styles.flow}>
      {prev ? (
        <Link href={prev.href} className={styles.prev}>
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="gp-btn gp-btn-ghost">
          Continue to {next.label} →
        </Link>
      )}
    </nav>
  );
}
