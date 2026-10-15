import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "../pages.module.css";

export const metadata: Metadata = { title: "Services · Ghost Protocol" };

const USES = [
  ["Incident response", "Correlate access logs, cameras and system events across sources whose clocks never quite agree."],
  ["Insurance & loss investigation", "Separate what the records support from what a claim asserts, with every step cited."],
  ["Workplace safety reviews", "Reconstruct an incident without assigning blame before the evidence allows it."],
] as const;

const PILOT = [
  ["Week 1", "Scope", "Pick one closed case and its sources."],
  ["Week 2", "Ingest", "Load redacted evidence; verify hashes."],
  ["Week 3", "Compare", "Rules versus the team’s own timeline."],
  ["Week 4", "Measure", "Time saved, conflicts found, trust."],
] as const;

export default function ServicesPage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Services</span>
        <h1 className={m.title}>Built for teams who have to explain what happened.</h1>
        <p className={m.lead}>
          Where evidence comes from many systems and the cost of a wrong timeline is high.
        </p>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Who it is for">
        <ul className={`${m.grid3} ${styles.plain}`}>
          {USES.map(([title, text], i) => (
            <li key={title} className={m.card}>
              <span className={m.no}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={m.section} aria-labelledby="pilot-heading">
        <div className={m.stack}>
          <span className="gp-eyebrow">How a pilot would run</span>
          <h2 id="pilot-heading" className={m.h2}>
            Four weeks, one real question.
          </h2>
        </div>
        <ol className={`${m.grid4} ${styles.plain} ${styles.track}`}>
          {PILOT.map(([week, title, text]) => (
            <li key={week} className={m.card}>
              <span className={m.label}>{week}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <p className={m.note}>
          A proposal, not a delivered engagement. Pilots require authentication and storage
          hardening first (see the security notes in{" "}
          <Link href="/resources">Resources</Link>).
        </p>
        <div className={m.row}>
          <Link href="/contact" className="gp-btn gp-btn-lime">
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}
