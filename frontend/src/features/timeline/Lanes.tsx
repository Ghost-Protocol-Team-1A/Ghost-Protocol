import Link from "next/link";
import { type Lane, shiftLabel } from "@/lib/lanes";
import styles from "./lanes.module.css";

const STATE_LABEL = {
  supported: "supported",
  contradicted: "contradicted",
  inferred: "inferred",
  unresolved: "unresolved",
} as const;

/**
 * Evidence lanes: one row per source, each event placed at its normalized time. When a clock
 * offset moved an event, a hollow ghost marks where the source clock put it.
 */
export function Lanes({
  lanes,
  ticks,
  hrefFor,
}: {
  lanes: Lane[];
  /** Labels spread evenly under the lanes, e.g. ["21:08", "21:14", "21:20"]. */
  ticks: string[];
  /** Optional link for each event mark (the workstation links to the event). */
  hrefFor?: (eventId: string) => string;
}) {
  return (
    <div className={styles.lanes}>
      {lanes.map((lane) => (
        <div key={lane.evidenceId} className={styles.lane}>
          <span className={styles.label}>
            <span className={styles.id}>{lane.evidenceId}</span> {lane.label}
          </span>
          <div className={styles.track}>
            {lane.marks.map((m, i) => {
              // One shift label per lane: every event from a source moves by the same offset.
              const firstShift = lane.marks.findIndex((x) => x.sourceAt !== null) === i;
              const title = `${m.eventId} · ${m.description} · ${STATE_LABEL[m.state]}`;
              const dot = (
                <span
                  className={`${styles.dot} ${styles[m.state]}`}
                  style={{ left: `${m.at}%` }}
                  title={title}
                  aria-label={title}
                />
              );
              return (
                <span key={m.eventId}>
                  {m.spread > 0 && (
                    <span
                      className={styles.band}
                      style={{ left: `${Math.max(0, m.at - m.spread)}%`, width: `${m.spread * 2}%` }}
                      aria-hidden="true"
                    />
                  )}
                  {m.sourceAt !== null && (
                    <>
                      <span className={styles.ghost} style={{ left: `${m.sourceAt}%` }} aria-hidden="true" />
                      <span
                        className={styles.shift}
                        style={{ left: `${Math.min(m.at, m.sourceAt)}%`, width: `${Math.abs(m.sourceAt - m.at)}%` }}
                        aria-hidden="true"
                      />
                      {firstShift && (
                        <span className={styles.shiftLabel} style={{ left: `${(m.at + m.sourceAt) / 2}%` }}>
                          {shiftLabel(m.offsetSeconds)}
                        </span>
                      )}
                    </>
                  )}
                  {hrefFor ? (
                    <Link href={hrefFor(m.eventId)} className={styles.hit} style={{ left: `${m.at}%` }}>
                      {dot}
                    </Link>
                  ) : (
                    dot
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div className={styles.ticks} aria-hidden="true">
        <span />
        <div>
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
