import type { Metadata } from "next";
import Link from "next/link";
import m from "@/features/site/marketing.module.css";
import styles from "./whitepaper.module.css";

export const metadata: Metadata = {
  title: "White paper · Inspectable incident reconstruction",
  description: "The method behind Ghost Protocol: two times per event, inferred clock offsets, named rules and four claim states.",
};

const TOC = [
  ["abstract", "Abstract"],
  ["problem", "1 · The problem"],
  ["time", "2 · Two times, one event"],
  ["offsets", "3 · Inferring a clock offset"],
  ["rules", "4 · Named rules"],
  ["states", "5 · Four claim states"],
  ["evaluation", "6 · Evaluation"],
  ["limits", "7 · Limits"],
] as const;

export default function WhitePaperPage() {
  return (
    <div className={styles.layout}>
      <nav aria-label="Contents" className={styles.toc}>
        <span className={m.label}>White paper</span>
        <ol>
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className={styles.article}>
        <header>
          <h1 className={m.title}>Inspectable incident reconstruction</h1>
          <p className={styles.byline}>Ghost Protocol team · October 2026 · v0.2</p>
        </header>

        <section id="abstract" className={styles.abstract}>
          <span className={m.label}>Abstract</span>
          <p>
            We describe a method for reconstructing incident timelines from fragmented evidence that
            keeps every original timestamp, records how each normalized time was derived, infers
            clock offsets from moments that several sources share, flags contradictions with
            deterministic named rules, and labels every claim as supported, contradicted, inferred
            or unresolved. On a fictional case and a blind second case the method produced the
            expected answers and identical results across repeated runs.
          </p>
        </section>

        <section id="problem">
          <h2>1 · The problem</h2>
          <p>
            After an incident, evidence arrives from systems that were never meant to agree: an
            access controller, two cameras, an inventory database, a witness. Their clocks drift,
            their records get copied between systems, and their gaps get filled by whoever writes
            the summary. A narrative that reads well can hide all three problems.
          </p>
          <p>
            Our aim is narrower than “find out what happened”. It is to show, for every statement in
            a timeline, which record supports it, which contradicts it, and what nobody can tell.
          </p>
        </section>

        <section id="time">
          <h2>2 · Two times, one event</h2>
          <p>
            An event carries the time its source recorded and a normalized time on a shared
            reference clock. The source time is never edited. The transformation is stored as a
            rule, for example <code>clock_offset:-120s</code>, so a reviewer can reverse it. An
            unknown timezone is never assumed to be UTC; the normalized time is left empty instead.
          </p>
          <figure className={styles.figure}>
            <div>
              <span className={m.label}>Source</span>
              <strong className="gp-mono">21:16:00</strong>
            </div>
            <span className={styles.arrow} aria-hidden="true">→</span>
            <div>
              <span className={m.label}>Normalized</span>
              <strong className={`gp-mono ${m.lime}`}>21:14:00</strong>
            </div>
            <figcaption className="gp-mono">EV-014 · E-02 loading-bay camera · RULE-TIME-002</figcaption>
          </figure>
        </section>

        <section id="offsets">
          <h2>3 · Inferring a clock offset</h2>
          <p>
            A camera rarely tells you its clock is wrong. But it often records moments that a
            trusted source also recorded: a door opening that the access log timestamps, an alarm
            that the alarm panel timestamps. We call each such pair an <em>anchor</em>.
          </p>
          <p>
            Each anchor gives one estimate of the offset: the camera’s time minus the reference
            time. We take the median, which one bad pairing cannot drag far, and keep the spread
            between estimates as uncertainty. Only anchors against a source on the reference clock
            count. With no usable anchor the clock stays unknown and nothing is moved.
          </p>
          <div className={styles.tableWrap}>
            <table className={m.table}>
              <thead>
                <tr>
                  <th scope="col">Camera event</th>
                  <th scope="col">Camera</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bay door opens (EV-013)</td>
                  <td className="gp-mono">21:14:00</td>
                  <td className="gp-mono">21:12:00 · access log</td>
                  <td className={`gp-mono ${m.lime}`}>+120 s</td>
                </tr>
                <tr>
                  <td>Alarm beacon (EV-017)</td>
                  <td className="gp-mono">21:18:00</td>
                  <td className="gp-mono">21:16:00 · alarm audio</td>
                  <td className={`gp-mono ${m.lime}`}>+120 s</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Both anchors agree, so the camera runs 120 s fast with no spread. The result is reported
            as a conflict under RULE-TIME-002 with both pairs listed, because an inferred offset is a
            claim a reviewer should be able to check.
          </p>
        </section>

        <section id="rules">
          <h2>4 · Named rules</h2>
          <p>
            Every contradiction comes from a rule with a stable ID. Each rule records what it
            compared, how, and what it cannot tell. Rules flag records for review; none concludes
            that anyone acted wrongly.
          </p>
          <ul className={styles.rules}>
            <li>
              <code>RULE-DUP-001</code> A row repeated in another source with the same key fields
              but a different time. <em>Cannot tell:</em> import job, manual edit or a genuine second
              event.
            </li>
            <li>
              <code>RULE-TIME-001</code> A declared clock offset. <em>Cannot tell:</em> whether it held
              for the whole recording.
            </li>
            <li>
              <code>RULE-TIME-002</code> An offset inferred from anchors. <em>Cannot tell:</em> whether
              it held outside the anchored moments.
            </li>
            <li>
              <code>RULE-CLAIM-001</code> An identity claim no source supports. <em>Cannot tell:</em>
              who the person is.
            </li>
          </ul>
        </section>

        <section id="states">
          <h2>5 · Four claim states</h2>
          <p>
            We do not attach probabilities to claims. A number like “82% likely” suggests a
            precision the evidence rarely has. Instead each claim is in one of four states, and each
            state has a test a reviewer can apply.
          </p>
          <dl className={styles.states}>
            <div>
              <dt className={styles.supported}>Supported</dt>
              <dd>A cited source records it and none conflicts.</dd>
            </div>
            <div>
              <dt className={styles.contradicted}>Contradicted</dt>
              <dd>A source conflicts, under a named rule.</dd>
            </div>
            <div>
              <dt className={styles.inferred}>Inferred</dt>
              <dd>Follows only from several sources together.</dd>
            </div>
            <div>
              <dt className={styles.unresolved}>Unresolved</dt>
              <dd>The evidence cannot settle it. It stays in the report.</dd>
            </div>
          </dl>
        </section>

        <section id="evaluation">
          <h2>6 · Evaluation</h2>
          <p>
            CASE-001 is a fictional warehouse incident with known answers written before the code.
            A second, blind case with different times, a slow clock and different IDs checks that
            nothing is hard-coded. Every change runs the full test suite. Ten repeated analyses of
            the same input produced byte-identical output, and a clean checkout reached passing
            checks and a working demo in about a minute.
          </p>
          <p>
            These results say the method is consistent and does what it claims on synthetic data.
            They say nothing about accuracy on real investigations.
          </p>
        </section>

        <section id="limits">
          <h2>7 · Limits</h2>
          <ul>
            <li>Video, audio and PDF extraction is simulated from metadata; the anchor events are too.</li>
            <li>A constant offset is assumed between anchors; drift is reported only as spread.</li>
            <li>The demo has no authentication and keeps state in memory.</li>
            <li>The tool is an investigative aid. People make every decision.</li>
          </ul>
          <p>
            <Link href="/dashboard?tour=1">See the method on CASE-001 →</Link>
          </p>
        </section>
      </article>
    </div>
  );
}
