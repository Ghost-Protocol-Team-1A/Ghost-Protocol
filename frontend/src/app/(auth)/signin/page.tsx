import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { currentIdentity } from "@/lib/session";
import styles from "../auth.module.css";
import { SignInForm } from "../IdentityForms";

export const metadata: Metadata = { title: "Sign in · Ghost Protocol" };

export default async function SignInPage() {
  const identity = await currentIdentity();
  return (
    <div className={styles.split}>
      <section className={styles.formSide}>
        <Logo href="/" />
        <div className={styles.formWrap}>
          <p className="gp-eyebrow">Demo access</p>
          <h1 className={styles.title}>Enter the workspace.</h1>
          <p className={styles.lead}>
            Choose who you are for this session. Your name appears on reviews and in the audit trail.
          </p>
          <SignInForm defaultName={identity?.name} />
        </div>
        <p className={styles.foot}>Investigative aid only. Demo data is fictional.</p>
      </section>
      <aside className={styles.showSide} aria-label="What your name is used for">
        <div className={styles.card}>
          <p className={styles.cardLabel}>AUDIT TRAIL · LIVE</p>
          <div className={styles.auditRow}>
            <strong>{identity?.name ?? "Your name"}</strong>
            <span>· Review recorded · C-02</span>
            <time>now</time>
          </div>
          <div className={styles.auditRow}>
            <strong>SYS</strong>
            <span>· Conflict created · C-01</span>
            <time>09:31</time>
          </div>
        </div>
        <p className={styles.tagline}>Every decision has a name, a time and a reason.</p>
      </aside>
    </div>
  );
}
