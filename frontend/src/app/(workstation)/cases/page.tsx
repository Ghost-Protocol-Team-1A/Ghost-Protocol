import Link from "next/link";
import panel from "@/components/panel.module.css";
import { api, ApiError } from "@/lib/api";
import { pad } from "@/lib/dashboard";
import styles from "./cases.module.css";

export default async function CasesPage() {
  let cases;
  try {
    cases = await api.cases();
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load cases: {message}
      </p>
    );
  }

  return (
    <section>
      <div className={styles.header}>
        <div>
          <h1 className={panel.pageTitle}>Cases</h1>
          <p className={panel.pageLead}>Every investigation, its incident window and its open review items.</p>
        </div>
        <Link href="/cases/new" className={styles.primary}>
          Create case
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Title</th>
              <th scope="col">Incident window</th>
              <th scope="col">Evidence</th>
              <th scope="col">Open conflicts</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map(({ case: c, evidence_count, open_conflicts }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/cases/${c.id}/${evidence_count ? "timeline" : "evidence"}`}>{c.id}</Link>
                </td>
                <td>
                  {c.title}
                  {c.fictional && <span className={styles.tag}>Fictional demo</span>}
                </td>
                <td className={panel.mono}>
                  {c.incident_start.slice(0, 10)} {c.incident_start.slice(11, 16)}–
                  {c.incident_end.slice(11, 16)} (UTC{c.incident_start.slice(19)})
                </td>
                <td>{pad(evidence_count)}</td>
                <td className={open_conflicts ? styles.coral : undefined}>{pad(open_conflicts)}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
