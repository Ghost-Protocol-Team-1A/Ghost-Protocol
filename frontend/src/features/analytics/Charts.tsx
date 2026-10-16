import { localTime } from "@/lib/api";
import { type Analytics, STATE_ORDER } from "@/lib/analytics";
import type { ClaimState } from "@/lib/types";
import styles from "./charts.module.css";

const LABEL: Record<ClaimState, string> = {
  contradicted: "Contradicted",
  unresolved: "Unresolved",
  inferred: "Inferred",
  supported: "Supported",
};

// Sequential lime ramp for the activity heatmap: near zero recedes into the surface.
const RAMP = ["#161a1f", "#2a3a12", "#3f5a17", "#5b8420", "#8cc63a", "#b8f54a"];

function Card({ title, sub, children, table }: { title: string; sub: string; children: React.ReactNode; table: React.ReactNode }) {
  return (
    <figure className={styles.viz} style={{ margin: 0 }}>
      <figcaption>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.sub}>{sub}</p>
      </figcaption>
      {children}
      <details className={styles.tableToggle}>
        <summary>Show as table</summary>
        {table}
      </details>
    </figure>
  );
}

export function StateLegend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {STATE_ORDER.map((s) => (
        <li key={s}>
          <span className={`${styles.key} ${styles[s]}`} aria-hidden="true" />
          {LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

function Stack({ counts, scale, label }: { counts: Record<ClaimState, number>; scale?: number; label: string }) {
  const total = STATE_ORDER.reduce((n, s) => n + counts[s], 0);
  if (total === 0) return <span className={styles.empty}>None</span>;
  return (
    <div className={styles.stack} style={scale ? { width: `${Math.max(8, (total / scale) * 100)}%` } : undefined}>
      {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span
          key={s}
          className={`${styles.seg} ${styles[s]} ${styles.tip}`}
          style={{ flex: counts[s] }}
          tabIndex={0}
          data-tip={`${label}: ${counts[s]} ${LABEL[s].toLowerCase()}`}
          aria-label={`${label}: ${counts[s]} ${LABEL[s].toLowerCase()}`}
        >
          {counts[s]}
        </span>
      ))}
    </div>
  );
}

export function ActivityChart({ a }: { a: Analytics }) {
  const max = Math.max(1, ...a.activity.flatMap((r) => r.bins));
  return (
    <Card
      title="Activity by source"
      sub="Events per time slice, normalized time"
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {a.activity.map((r) => (
              <tr key={r.evidenceId}>
                <td>
                  {r.evidenceId} {r.label}
                </td>
                <td>{r.bins.reduce((n, b) => n + b, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {a.activity.length === 0 ? (
        <p className={styles.empty}>No events match these filters.</p>
      ) : (
        <>
          {a.activity.map((r) => (
            <div key={r.evidenceId} className={styles.row}>
              <span className={styles.rowLabel}>
                {r.evidenceId} {r.label}
              </span>
              <div className={styles.hist}>
                {r.bins.map((b, i) => (
                  <span
                    key={i}
                    className={`${styles.col} ${b ? styles.tip : ""}`}
                    tabIndex={b ? 0 : undefined}
                    data-tip={b ? `${r.evidenceId}: ${b} event${b === 1 ? "" : "s"}` : undefined}
                    aria-label={b ? `${r.evidenceId}: ${b} events in slice ${i + 1}` : undefined}
                  >
                    {b ? <span className={styles.colBar} style={{ height: `${(b / max) * 100}%` }} /> : <span className={styles.colEmpty} />}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {a.binLabels.length > 0 && (
            <div className={styles.row}>
              <span />
              <div className={styles.axis}>
                {a.binLabels.map((t) => (
                  <span key={t}>{localTime(t).slice(0, 5)}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function ReliabilityChart({ a }: { a: Analytics }) {
  const scale = Math.max(1, ...a.reliability.map((r) => STATE_ORDER.reduce((n, s) => n + r.counts[s], 0)));
  return (
    <Card
      title="How each source holds up"
      sub="Events by state"
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              {STATE_ORDER.map((s) => (
                <th key={s}>{LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.reliability.map((r) => (
              <tr key={r.evidenceId}>
                <td>{r.evidenceId}</td>
                {STATE_ORDER.map((s) => (
                  <td key={s}>{r.counts[s]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <StateLegend />
      {a.reliability.length === 0 && <p className={styles.empty}>No events match these filters.</p>}
      {a.reliability.map((r) => (
        <div key={r.evidenceId} className={styles.row}>
          <span className={styles.rowLabel}>
            {r.evidenceId} {r.label}
          </span>
          <Stack counts={r.counts} scale={scale} label={r.evidenceId} />
        </div>
      ))}
    </Card>
  );
}

export function ClaimsChart({ a }: { a: Analytics }) {
  const total = STATE_ORDER.reduce((n, s) => n + a.claims[s], 0);
  return (
    <Card
      title="Claims"
      sub={`${total} claim${total === 1 ? "" : "s"} by state`}
      table={
        <table className={styles.table}>
          <tbody>
            {STATE_ORDER.map((s) => (
              <tr key={s}>
                <td>{LABEL[s]}</td>
                <td>{a.claims[s]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <Stack counts={a.claims} label="Claims" />
      <StateLegend />
    </Card>
  );
}

export function ClockChart({ a }: { a: Analytics }) {
  const max = Math.max(1, ...a.clocks.map((c) => Math.abs(c.offset)));
  const off = a.clocks.filter((c) => c.offset !== 0);
  const trusted = a.clocks.length - off.length;
  return (
    <Card
      title="Clock corrections"
      sub="How far each source's clock was off"
      table={
        <table className={styles.table}>
          <tbody>
            {a.clocks.map((c) => (
              <tr key={c.evidenceId}>
                <td>{c.evidenceId}</td>
                <td>{c.offset === 0 ? "0 s" : `${Math.abs(c.offset)} s ${c.offset > 0 ? "fast" : "slow"}`}</td>
                <td>{c.method.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {off.map((c) => (
        <div key={c.evidenceId} className={styles.row}>
          <span className={styles.rowLabel}>
            {c.evidenceId} {c.label}
          </span>
          <div className={styles.clock}>
            <span className={styles.zero} aria-hidden="true" />
            <span
              className={`${styles.clockBar} ${styles.tip}`}
              style={{ width: `${(Math.abs(c.offset) / max) * 60}%` }}
              tabIndex={0}
              data-tip={c.method.replaceAll("_", " ")}
              aria-label={`${c.evidenceId} ${Math.abs(c.offset)} seconds ${c.offset > 0 ? "fast" : "slow"}`}
            />
            <span className="gp-mono" style={{ fontSize: 12 }}>
              {Math.abs(c.offset)} s {c.offset > 0 ? "fast" : "slow"}
            </span>
          </div>
        </div>
      ))}
      <div className={styles.row}>
        <span className={styles.rowLabel}>{off.length ? `${trusted} others` : "All sources"}</span>
        <div className={styles.clock}>
          <span className={styles.zero} aria-hidden="true" />
          <span className="gp-mono" style={{ fontSize: 12, color: "var(--gp-text-muted)" }}>
            0 s · trusted or not yet set
          </span>
        </div>
      </div>
    </Card>
  );
}

export function ConflictTable({ a }: { a: Analytics }) {
  return (
    <figure className={styles.viz} style={{ margin: 0 }}>
      <figcaption>
        <h3 className={styles.title}>Conflicts</h3>
        <p className={styles.sub}>By rule and decision</p>
      </figcaption>
      {a.conflicts.length === 0 ? (
        <p className={styles.empty}>No rule has flagged anything.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Open</th>
              <th>Decided</th>
            </tr>
          </thead>
          <tbody>
            {a.conflicts.map((c) => (
              <tr key={c.rule}>
                <td className="gp-mono">{c.rule}</td>
                <td>{c.open}</td>
                <td>{c.decided}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

export function HeatmapChart({ a }: { a: Analytics }) {
  const active = a.heat.flatMap((h) => h.hours.map((v, i) => (v ? i : -1))).filter((i) => i >= 0);
  if (active.length === 0) {
    return <p className={styles.empty}>No recorded activity yet.</p>;
  }
  // Show at least a 12-hour span so a short burst of activity still reads as a timeline.
  let from = Math.min(...active);
  let to = Math.max(...active);
  while (to - from < 11) {
    if (from > 0) from -= 1;
    if (to - from < 11 && to < 23) to += 1;
  }
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(1, ...a.heat.flatMap((h) => h.hours));
  const cols = `110px repeat(${hours.length}, minmax(14px, 1fr))`;
  return (
    <Card
      title="Who did what, when"
      sub="Audit actions per hour (UTC) · brighter is more"
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Actor</th>
              <th>Actions</th>
              <th>Busiest hour</th>
            </tr>
          </thead>
          <tbody>
            {a.heat.map((h) => {
              const total = h.hours.reduce((n, v) => n + v, 0);
              const top = h.hours.indexOf(Math.max(...h.hours));
              return (
                <tr key={h.actor}>
                  <td>{h.actor}</td>
                  <td>{total}</td>
                  <td>{String(top).padStart(2, "0")}:00</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
    >
      {a.heat.map((h) => (
        <div key={h.actor} className={styles.heat} style={{ gridTemplateColumns: cols }}>
          <span className={styles.rowLabel}>{h.actor}</span>
          {hours.map((hr) => {
            const v = h.hours[hr];
            const step = v === 0 ? 0 : Math.max(1, Math.round((v / max) * 5));
            return (
              <span
                key={hr}
                className={`${styles.cell} ${v ? styles.tip : ""}`}
                style={{ background: RAMP[step] }}
                tabIndex={v ? 0 : undefined}
                data-tip={v ? `${h.actor} · ${String(hr).padStart(2, "0")}:00 · ${v} action${v === 1 ? "" : "s"}` : undefined}
                aria-label={v ? `${h.actor}, ${v} actions at ${hr}:00` : undefined}
              />
            );
          })}
        </div>
      ))}
      <div className={styles.heat} style={{ gridTemplateColumns: cols }}>
        <span />
        {hours.map((hr) => (
          <span key={hr} className={styles.axis} style={{ justifyContent: "center" }}>
            {String(hr).padStart(2, "0")}
          </span>
        ))}
      </div>
    </Card>
  );
}
