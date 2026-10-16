import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "Guide · Ghost Protocol",
  description: "From first file to a signed conclusion: how to use Ghost Protocol, step by step.",
};

const STEPS = [
  {
    title: "Sign in",
    where: "/signin",
    what: "Type your name and pick a role. There is no password: it is a demo identity.",
    why: "Every decision, observation and signature is recorded under that name in the audit trail.",
  },
  {
    title: "Create a case",
    where: "/cases/new",
    what: "Give it a title, the scope (what it must establish, and what it must not) and the incident window.",
    why: "The window's UTC offset is used for any time recorded without one, and every event says so.",
  },
  {
    title: "Upload evidence",
    where: "Intake",
    what: "Logs (CSV, JSON, text), statements (PDF, Word), photos, audio and video, up to 50 MB each.",
    why: "Each file is checked against its contents, fingerprinted with SHA-256 and never changed.",
  },
  {
    title: "Extract events",
    where: "Extract",
    what: "Logs become events on upload. For recordings, log what you see at a timecode. For documents and photos, ask the AI to read them and accept or reject each suggestion.",
    why: "Nothing the AI proposes reaches the timeline until a named person accepts it. Quotes are checked word for word.",
  },
  {
    title: "Set clocks",
    where: "Evidence → Source clock",
    what: "Mark a source as trusted, state a known error, or pair moments it shares with a trusted source.",
    why: "Matching moments lets the engine work the error out itself (RULE-TIME-002). Original times never change.",
  },
  {
    title: "Read the timeline and decide conflicts",
    where: "Timeline · Graph · Analytics · Conflicts",
    what: "See every source on one clock, how the evidence connects, and what each rule flagged. Record a decision with a reason for every conflict.",
    why: "A conflict is a prompt for review, never an accusation. Signing waits until every conflict is decided.",
  },
  {
    title: "Write questions and claims",
    where: "Questions & claims",
    what: "Write what the case must answer. Attach claims, each citing the evidence it rests on.",
    why: "A claim's state must match its citations: nothing is called supported without a source.",
  },
  {
    title: "Conclude and sign",
    where: "Conclusion",
    what: "Answer each question as established, partly established or not established, cite the records, confirm both statements and sign.",
    why: "Established needs a supported claim. Each signature is a version; the report carries it with the doubts left in.",
  },
] as const;

const TOOLS = [
  ["AI assistant", "A briefing that pulls the case together, and answers to questions in plain language, all cited. Claude Sonnet 5.5; it never decides."],
  ["Analytics", "Activity by source, how each source holds up, claims, clock corrections, conflicts and who did what. Filters apply to every chart."],
  ["Power BI / Tableau", "Analytics → Download: an Excel workbook of tidy tables that both tools open directly."],
  ["⌘K", "Press ⌘K, Ctrl+K or / anywhere in the workspace to jump to any record."],
  ["Guided demo", "Seven stops through the fictional case, from the home page or the dashboard."],
] as const;

export default function GuidePage() {
  return (
    <>
      <section className={m.hero}>
        <span className="gp-eyebrow">Guide</span>
        <h1 className={m.title}>From first file to signed conclusion.</h1>
        <p className={m.lead}>
          Eight steps. Each case shows where you are and the next thing to do on its overview page. The AI can read and
          suggest; only people decide.
        </p>
        <div className={m.row}>
          <Link href="/signin" className="gp-btn gp-btn-lime">
            Start: sign in
          </Link>
          <Link href="/cases/CASE-001" className="gp-btn gp-btn-ghost">
            Open the demo case
          </Link>
        </div>
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="Steps">
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={m.card}>
              <span className={m.no}>{String(i + 1).padStart(2, "0")}</span>
              <h2 className={styles.h}>{s.title}</h2>
              <p className={styles.where}>
                {s.where.startsWith("/") ? <Link href={s.where}>{s.where}</Link> : s.where}
              </p>
              <p>{s.what}</p>
              <p className={styles.why}>{s.why}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={m.section} aria-labelledby="tools-heading">
        <h2 id="tools-heading" className={m.h2}>
          Tools along the way
        </h2>
        <dl className={styles.tools}>
          {TOOLS.map(([name, text]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={m.section} aria-labelledby="rules-heading">
        <div className={m.callout}>
          <div className={m.stack}>
            <h2 id="rules-heading" className={m.h2}>
              Three rules for a sound conclusion
            </h2>
            <ol className={styles.rules}>
              <li>Cite the record for everything you state.</li>
              <li>Write &quot;not established&quot; when the evidence cannot settle it.</li>
              <li>Never name who is responsible unless a cited record shows it.</li>
            </ol>
          </div>
          <Link href="/cases/CASE-001" className="gp-btn gp-btn-lime">
            Try it on the demo case
          </Link>
        </div>
      </section>
    </>
  );
}
