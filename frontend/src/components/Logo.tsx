import Link from "next/link";
import styles from "./Logo.module.css";

/** Shield = chain of custody, check = reviewed evidence, cyan dot = provenance (brand board 70:2). */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.logo} aria-label="Ghost Protocol home">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path
          d="M14 3 5 6.5v6.8c0 5.6 3.8 10.1 9 11.7 5.2-1.6 9-6.1 9-11.7V6.5L14 3Z"
          stroke="var(--gp-lime)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m9.8 14.2 3 3 5.6-6"
          stroke="var(--gp-lime)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22.5" cy="5.5" r="2.2" fill="var(--gp-cyan)" />
      </svg>
      <span>GHOST PROTOCOL</span>
    </Link>
  );
}
