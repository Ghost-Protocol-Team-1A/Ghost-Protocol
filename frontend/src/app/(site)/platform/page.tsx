import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "../pages.module.css";

export const metadata: Metadata = { title: "Platform · Ghost Protocol" };

const STAGES = [
  ["Ingest & provenance", "Every file is fingerprinted", "SHA-256 of the original bytes, content-type checks that catch a renamed executable, storage by hash, duplicates recognized."],
  ["Time normalization", "Clocks aligned, originals kept", "Source time never changes. Normalized time is stored beside it with its rule. Offsets are inferred by matching moments that several sources recorded."],
  ["Conflict rules", "Contradictions with a name", "RULE-DUP-001 copied records, RULE-TIME-001/002 declared and inferred clock offsets, RULE-CLAIM-001 unsupported identity. Each states what it cannot tell."],
  ["Claims & hypotheses", "Four states, no fake odds", "Supported, Contradicted, Inferred, Unresolved, each citing evidence. Competing explanations compared side by side."],
  ["Review & audit", "Humans decide, on the record", "Decisions need a reason and land in an append-only audit trail with who, when and why. They survive re-analysis."],
  ["Report", "Exports that keep the doubt", "Markdown and JSON with sources, both times, rules, hypotheses, unresolved questions and limitations."],
] as const;

export default function PlatformPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Platform</span>
        <h1 className={m.title}>One engine for every step between raw evidence and a report you can defend.</h1>
        <p className={m.lead}>
          Six stages, each with an output a reviewer can open. Deterministic where it matters,
          labeled where it is simulated.
        </p>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Stages">
        <ol className={`${m.grid3} ${styles.plain}`}>
          {STAGES.map(([label, title, text], i) => (
            <li key={label} className={m.card}>
              <span className={m.label}>
                <span className={m.lime}>{String(i + 1).padStart(2, "0")}</span> · {label}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={m.section} aria-labelledby="arch-heading">
        <div className={m.stack}>
          <span className="gp-eyebrow">Architecture</span>
          <h2 id="arch-heading" className={m.h2}>
            Private engine, public interface.
          </h2>
          <p className={m.lead}>
            The browser only talks to the website. The evidence engine runs beside it and is never
            exposed to the internet. No AI model decides an outcome.
          </p>
        </div>
        <div className={styles.arch}>
          <div className={styles.node}>
            <span className={m.label}>Client</span>
            <strong>Investigator’s browser</strong>
          </div>
          <span className={styles.arrow} aria-hidden="true">→</span>
          <div className={styles.node}>
            <span className={m.label}>Public</span>
            <strong>Website · server actions</strong>
          </div>
          <span className={styles.arrow} aria-hidden="true">→</span>
          <div className={`${styles.node} ${styles.engine}`}>
            <span className={m.label}>Private · 127.0.0.1</span>
            <strong>Evidence engine</strong>
            <ul>
              <li>Rules: deterministic, versioned IDs</li>
              <li>Store: resettable demo state</li>
              <li>Files: content-addressed</li>
            </ul>
          </div>
        </div>
        <div className={m.row}>
          <Link href="/dashboard" className="gp-btn gp-btn-lime">
            Open the workspace
          </Link>
          <Link href="/whitepaper" className="gp-btn gp-btn-ghost">
            Read the white paper
          </Link>
        </div>
      </section>
    </>
  );
}
