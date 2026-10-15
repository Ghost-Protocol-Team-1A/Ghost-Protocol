import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "../pages.module.css";

export const metadata: Metadata = { title: "Resources · Ghost Protocol" };

const REPO = "https://github.com/Ghost-Protocol-Team-1A/Ghost-Protocol/blob/main";

const DOCS = [
  ["Architecture", "How it is built", "Pipeline, rules, API, storage, and the decisions behind them.", `${REPO}/docs/architecture.md`],
  ["Security", "Controls and limits", "What the demo protects, what it does not, what a real deployment needs.", `${REPO}/docs/security.md`],
  ["Demo case", "CASE-001, fully specified", "Six evidence items, expected answers, acceptance checks.", `${REPO}/docs/demo-scenario.md`],
  ["Evaluation", "How we verify it works", "Known-answer tests, blind case, determinism, clean setup.", `${REPO}/docs/evaluation.md`],
  ["API", "API reference", "Every endpoint, request and error shape.", `${REPO}/README.md#api`],
] as const;

const FAQ = [
  ["Is this AI?", "No model decides anything. Rules are fixed code with IDs; the same input always gives the same output."],
  ["Is the data real?", "No. Every case in the demo is fictional and labeled as such on every screen."],
  ["Does it accuse anyone?", "Never. Identity stays Unresolved unless a source supports it."],
  ["What is simulated?", "Video, audio and PDF extraction comes from metadata in the MVP, and the screen says so. Log files are parsed for real."],
  ["How is a clock offset found?", "From anchors: moments a camera shares with sources on a trusted clock. The median difference is the offset, and every pair is shown."],
] as const;

export default function ResourcesPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Resources</span>
        <h1 className={m.title}>Everything we know, written down.</h1>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Documents">
        <ul className={`${m.grid3} ${styles.plain}`}>
          <li>
            <Link href="/whitepaper" className={`${m.card} ${m.cardLink} ${styles.feature}`}>
              <span className={m.label}>White paper</span>
              <h3>Inspectable incident reconstruction</h3>
              <p>The method: time normalization, named rules, four claim states.</p>
              <span className={m.more}>Read →</span>
            </Link>
          </li>
          {DOCS.map(([label, title, text, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noreferrer" className={`${m.card} ${m.cardLink}`}>
                <span className={m.label}>{label}</span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className={m.more}>Open on GitHub →</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={m.section} aria-labelledby="faq-heading">
        <h2 id="faq-heading" className={m.h2}>
          Questions judges ask
        </h2>
        <div className={styles.faq}>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
