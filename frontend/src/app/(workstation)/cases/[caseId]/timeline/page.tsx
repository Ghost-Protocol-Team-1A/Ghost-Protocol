import { StateBadge } from "@/components/StateBadge";
import { api, ApiError, localTime } from "@/lib/api";
import styles from "./timeline.module.css";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  let events;
  try {
    events = await api.timeline(caseId);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={styles.error}>
        Could not load the timeline: {message}
      </p>
    );
  }

  return (
    <section>
      <h1 className={styles.title}>Investigation timeline</h1>
      <p className={styles.caption}>Source and normalized time are displayed separately.</p>
      <ol className={styles.list}>
        {events.map((e) => (
          <li key={e.id} className={styles.row}>
            <div className={styles.times}>
              <span className={styles.normalized}>
                {e.approximate ? "~" : ""}
                {localTime(e.normalized_time)}
              </span>
              {e.offset_seconds !== 0 && (
                <span className={styles.source}>
                  source {e.source_time?.slice(11, 19)} ({-e.offset_seconds / 60 > 0 ? "+" : "−"}
                  {Math.abs(e.offset_seconds / 60)} min)
                </span>
              )}
            </div>
            <div>
              <p className={styles.description}>{e.description}</p>
              <p className={styles.locator}>
                {e.id} · {e.evidence_id} · {e.locator}
              </p>
            </div>
            <StateBadge state={e.state} />
          </li>
        ))}
      </ol>
    </section>
  );
}
