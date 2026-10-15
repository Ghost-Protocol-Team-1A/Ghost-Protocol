import Link from "next/link";
import { Logo } from "@/components/Logo";
import styles from "./site.module.css";

const NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/services", label: "Services" },
  { href: "/why", label: "Why Ghost Protocol" },
  { href: "/resources", label: "Resources" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

const REPO = "https://github.com/Ghost-Protocol-Team-1A/Ghost-Protocol";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Logo href="/" />
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/signin" className={`gp-btn gp-btn-quiet ${styles.signin}`}>
            Sign in
          </Link>
          <Link href="/dashboard" className={`gp-btn gp-btn-lime ${styles.open}`}>
            Open workspace
          </Link>
          <details className={styles.menu}>
            <summary aria-label="Menu">
              <span />
              <span />
            </summary>
            <nav aria-label="Main (mobile)" className={styles.menuPanel}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <Link href="/signin">Sign in</Link>
              <Link href="/dashboard" className={styles.menuCta}>
                Open workspace
              </Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footBrand}>
          <Logo href="/" />
          <p>Investigative aid only. Demo data is fictional.</p>
        </div>
        <nav aria-label="Footer" className={styles.footNav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/whitepaper">White paper</Link>
          <a href={REPO} rel="noreferrer" target="_blank">
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  );
}
