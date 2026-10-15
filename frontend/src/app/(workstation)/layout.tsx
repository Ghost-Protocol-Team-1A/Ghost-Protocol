import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "./workstation.module.css";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/cases/CASE-001/timeline", label: "Timeline" },
  { href: "/cases/CASE-001/conflicts", label: "Conflicts" },
  { href: "/cases/CASE-001/hypotheses", label: "Hypotheses" },
  { href: "/cases/CASE-001/intake", label: "Evidence intake" },
  { href: "/cases/CASE-001/evidence", label: "Evidence" },
  { href: "/cases/CASE-001/report", label: "Report" },
  { href: "/cases/CASE-001/audit", label: "Audit trail" },
];

export default function WorkstationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Logo href="/dashboard" />
        <span className={styles.demo}>SYNTHETIC DEMO DATA</span>
      </header>
      <aside className={styles.sidebar}>
        <p className={styles.section}>WORKSPACE</p>
        <nav aria-label="Workspace">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <p className={styles.section}>CURRENT CASE</p>
        <p>CASE-001</p>
        <p className={styles.muted}>Warehouse incident</p>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
