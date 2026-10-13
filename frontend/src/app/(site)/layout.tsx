import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "./site.module.css";

const NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/services", label: "Services" },
  { href: "/why", label: "Why Ghost Protocol" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Logo />
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className={styles.cta}>
            Open demo workspace
          </Link>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <Logo />
        <p>Investigative aid only. Demo data is fictional.</p>
      </footer>
    </div>
  );
}
