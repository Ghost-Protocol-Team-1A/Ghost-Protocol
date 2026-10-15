import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "../pages.module.css";

export const metadata: Metadata = { title: "Why Ghost Protocol" };

const PRINCIPLES = [
  ["Evidence first", "Every claim links to a source and an exact place in it."],
  ["Reasoning visible", "Every conflict names the rule and the records it compared."],
  ["Uncertainty kept", "“We can’t tell” survives all the way into the report."],
  ["Humans accountable", "People decide, with reasons, on the record."],
] as const;

const COMPARE = [
  ["A camera clock is wrong", "Times overwritten to line up", "Source kept, normalized beside it, offset inferred and shown"],
  ["A log row was copied", "Looks like a second event", "Flagged by RULE-DUP-001, not called tampering"],
  ["Who was on camera?", "Inferred and stated", "Unresolved until a source supports it"],
  ["Which explanation is right?", "A confidence score", "Evidence for and against; a person decides"],
  ["New evidence arrives", "Summary rewritten", "Shows what changed and what did not"],
] as const;

export default function WhyPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Why Ghost Protocol</span>
        <h1 className={m.title}>
          Most tools tell you a story. <span className={m.lime}>We show you the evidence for it, and against it.</span>
        </h1>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Principles">
        <ul className={`${m.grid4} ${styles.plain}`}>
          {PRINCIPLES.map(([title, text], i) => (
            <li key={title} className={m.card}>
              <span className={m.no}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={m.section} aria-labelledby="compare-heading">
        <h2 id="compare-heading" className={m.h2}>
          The difference, side by side
        </h2>
        <div className={m.tableWrap}>
          <table className={m.table}>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Typical approach</th>
                <th scope="col" className={m.lime}>
                  Ghost Protocol
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([q, typical, us]) => (
                <tr key={q}>
                  <td>{q}</td>
                  <td>{typical}</td>
                  <td className={m.us}>{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={m.row}>
          <Link href="/dashboard?tour=1" className="gp-btn gp-btn-lime">
            See it in the guided demo
          </Link>
        </div>
      </section>
    </>
  );
}
