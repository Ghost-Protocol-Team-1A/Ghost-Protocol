import Link from "next/link";
import panel from "@/components/panel.module.css";
import { api, ApiError } from "@/lib/api";
import { CASE_FILTERS, CLASSIFICATIONS, filterCases } from "@/lib/cases";
import { pad } from "@/lib/dashboard";
import styles from "./cases.module.css";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
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

  const shown = filterCases(cases, filter);

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

      <nav aria-label="Filter cases" className={styles.tabs}>
        {CASE_FILTERS.map((f) => {
          const current = (filter ?? "all") === f.id;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/cases" : `/cases?filter=${f.id}`}
              aria-current={current ? "page" : undefined}
              className={styles.tab}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

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
              <th scope="col">Data</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  No cases match this filter.
                </td>
              </tr>
            )}
            {shown.map(({ case: c, evidence_count, open_conflicts }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/cases/${c.id}`}>{c.id}</Link>
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
                <td>{CLASSIFICATIONS.find((x) => x.value === c.classification)?.label ?? c.classification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
