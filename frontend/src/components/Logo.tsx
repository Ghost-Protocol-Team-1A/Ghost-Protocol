import Link from "next/link";
import styles from "./Logo.module.css";

/** Solid lime shield with an ink check (Figma: v2 · BRAND). Shield = chain of custody, check = reviewed. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <path
        d="M16 2.5 4.5 7v8.4c0 6.9 4.7 12.4 11.5 14.1 6.8-1.7 11.5-7.2 11.5-14.1V7L16 2.5Z"
        fill="var(--gp-lime)"
      />
      <path
        d="m10.5 16.2 3.7 3.7 7.3-7.6"
        fill="none"
        stroke="var(--gp-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.logo} aria-label="Ghost Protocol home">
      <LogoMark />
      <span>GHOST PROTOCOL</span>
    </Link>
  );
}
