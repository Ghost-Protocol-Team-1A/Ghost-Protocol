import Link from "next/link";
import { Icon } from "@/components/Icon";
import m from "@/features/site/marketing.module.css";
import { Lanes } from "@/features/timeline/Lanes";
import { api } from "@/lib/api";
import { buildLanes, type Lane } from "@/lib/lanes";
import styles from "./landing.module.css";

const CASE_ID = "CASE-001";
// 21:08–21:20 at the fictional site (UTC+01:00): the minutes where CASE-001's sources overlap.
const WINDOW = { start: "2026-10-10T20:08:00Z", end: "2026-10-10T20:20:00Z" };

const STEPS = [
  ["Ingest", "SHA-256 of the original bytes."],
  ["Extract", "Events with exact row or timecode."],
  ["Normalize", "Source time kept; offsets detected."],
  ["Compare", "Named rules flag conflicts."],
  ["Review", "Humans decide, with reasons."],
  ["Report", "Unknowns stay in the export."],
] as const;

const STATES = [
  ["supported", "Supported", "A cited source records it."],
  ["contradicted", "Contradicted", "A source conflicts, under a named rule."],
  ["inferred", "Inferred", "Follows from several sources."],
  ["unresolved", "Unresolved", "The evidence can’t settle it."],
] as const;

async function liveLanes(): Promise<{ lanes: Lane[]; openConflicts: number } | null> {
  try {
    const [events, evidence, conflicts] = await Promise.all([
      api.timeline(CASE_ID),
      api.evidence(CASE_ID),
      api.conflicts(CASE_ID),
    ]);
    const openConflicts = conflicts.filter((c) => c.status === "open").length;
    return { lanes: buildLanes(events, evidence, WINDOW.start, WINDOW.end), openConflicts };
  } catch {
    return null;
  }
}

export default async function Home() {
  const live = await liveLanes();

  return (
    <>
      <section className={m.hero}>
        <span className="gp-chip gp-chip-lime">
          <span className={styles.pulse} aria-hidden="true" /> Live demo · fictional data
        </span>
        <h1 className={m.display}>
          Reconstruct what happened.
          <br />
          Show the evidence. <span className={m.lime}>Reveal what remains unknown.</span>
        </h1>
        <p className={m.lead}>
          Ghost Protocol aligns fragmented evidence into one inspectable timeline, flags
          contradictions with the rule that found them, and never presents an inference as a fact.
        </p>
        <div className={m.row}>
          <Link href="/dashboard?tour=1" className="gp-btn gp-btn-lime">
            <Icon name="play" size={16} /> Start guided demo
          </Link>
          <Link href="/dashboard" className="gp-btn gp-btn-ghost">
            Explore the workspace
          </Link>
        </div>

        {live && live.lanes.length > 0 && (
          <figure className={styles.board}>
            <figcaption className={styles.boardHead}>
              <span className="gp-mono">{CASE_ID} · TIMELINE · 21:08 — 21:20 · live from the engine</span>
              {live.openConflicts > 0 && (
                <Link href={`/cases/${CASE_ID}/conflicts`} className={styles.conflictChip}>
                  {live.openConflicts} open conflict{live.openConflicts === 1 ? "" : "s"}
                </Link>
              )}
            </figcaption>
            <Lanes lanes={live.lanes} ticks={["21:08", "21:11", "21:14", "21:17", "21:20"]} />
            <p className={styles.legend}>
              <span>
                <i className={styles.ghostKey} /> where the camera clock put it
              </span>
              <span>
                <i className={styles.dotKey} /> normalized time
              </span>
              <span>
                <i className={styles.conKey} /> contradicted record
              </span>
              <span>
                <i className={styles.bandKey} /> witness estimate ±2 min
              </span>
            </p>
          </figure>
        )}
      </section>

      <section className={`${m.section} ${m.flush}`} aria-label="By the numbers">
        <ul className={`${m.grid4} ${styles.stats}`}>
          <li className={m.card}>
            <span className={m.stat}>150+</span>
            <p>automated tests run on every change</p>
          </li>
          <li className={m.card}>
            <span className={`${m.stat} ${m.lime}`}>10/10</span>
            <p>identical results across repeated runs</p>
          </li>
          <li className={m.card}>
            <span className={m.stat}>4</span>
            <p>named rules, each says what it cannot tell</p>
          </li>
          <li className={m.card}>
            <span className={m.stat}>0</span>
            <p>AI models deciding outcomes</p>
          </li>
        </ul>
      </section>

      <section className={m.section} aria-labelledby="how-heading">
        <div className={m.headRow}>
          <div className={m.stack}>
            <span className="gp-eyebrow">How it works</span>
            <h2 id="how-heading" className={m.h2}>
              Six steps. Every one inspectable.
            </h2>
          </div>
          <Link href="/platform" className="gp-btn gp-btn-ghost">
            See the platform <Icon name="arrow" size={14} />
          </Link>
        </div>
        <ol className={`${m.grid6} ${styles.steps}`}>
          {STEPS.map(([title, text], i) => (
            <li key={title} className={m.card}>
              <span className={m.no}>{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={m.section} aria-labelledby="rule-heading">
        <div className={styles.ruleGrid}>
          <div className={m.stack}>
            <span className="gp-eyebrow">Our rule</span>
            <h2 id="rule-heading" className={m.h2}>
              It never says who did it.
            </h2>
            <p className={m.lead}>
              A contradiction is a prompt for review, not proof of wrongdoing. Identity claims
              without evidence stay Unresolved. Every decision is made by a person, with a reason,
              in the audit trail.
            </p>
          </div>
          <ul className={styles.states}>
            {STATES.map(([key, label, text]) => (
              <li key={key} className={styles.state}>
                <span className={`${styles.stateDot} ${styles[key]}`} aria-hidden="true" />
                <div>
                  <strong>{label}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={m.section} aria-labelledby="cta-heading">
        <div className={m.callout}>
          <div className={m.stack}>
            <h2 id="cta-heading" className={m.h2}>
              See it on a real (fictional) case.
            </h2>
            <p className={m.lead}>Five minutes, guided, no sign-up.</p>
          </div>
          <Link href="/dashboard?tour=1" className="gp-btn gp-btn-lime">
            <Icon name="play" size={16} /> Start guided demo
          </Link>
        </div>
      </section>
    </>
  );
}
