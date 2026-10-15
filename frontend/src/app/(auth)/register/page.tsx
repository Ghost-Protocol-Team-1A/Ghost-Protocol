import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import styles from "../auth.module.css";
import { RegisterForm } from "../IdentityForms";

export const metadata: Metadata = { title: "New workspace · Ghost Protocol" };

const STEPS = [
  ["01", "Define the scope", "What the case tries to establish, and what it does not."],
  ["02", "Add evidence", "Every file hashed and checked on arrival."],
  ["03", "Read the timeline", "Rules flag conflicts; you decide."],
] as const;

export default function RegisterPage() {
  return (
    <div className={styles.split}>
      <section className={styles.formSide}>
        <Logo href="/" />
        <div className={styles.formWrap}>
          <p className="gp-eyebrow">New workspace</p>
          <h1 className={styles.title}>Start your own case.</h1>
          <p className={styles.lead}>Name yourself and your first case. You set the scope next.</p>
          <RegisterForm />
        </div>
        <p className={styles.foot}>Investigative aid only. Demo data is fictional.</p>
      </section>
      <aside className={styles.showSide} aria-labelledby="next-heading">
        <p id="next-heading" className={styles.cardLabel}>
          WHAT HAPPENS NEXT
        </p>
        <ol className={styles.steps}>
          {STEPS.map(([no, title, text]) => (
            <li key={no} className={styles.step}>
              <span className={styles.stepNo}>{no}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
