import Link from "next/link";
import panel from "@/components/panel.module.css";
import { UploadForm } from "@/features/intake/UploadForm";
import { api, ApiError } from "@/lib/api";
import styles from "./page.module.css";

const STATUS_LABEL = {
  queued: "Queued · stored, not extracted",
  processing: "Processing",
  extracted: "Extracted",
  failed: "Failed",
} as const;

export default async function IntakePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;

  let evidence;
  try {
    evidence = await api.evidence(caseId);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <p role="alert" className={panel.error}>
        Could not load evidence intake: {message}
      </p>
    );
  }

  return (
    <section>
      <h1 className={panel.pageTitle}>Evidence intake</h1>
      <p className={panel.pageLead}>
        Ingest source material, preserve originals, and track validation and extraction separately.
      </p>

      <div className={styles.layout}>
        <section className={panel.panel} aria-label="Upload evidence">
          <UploadForm caseId={caseId} />
        </section>

        <aside className={panel.panel} aria-labelledby="before-heading">
          <h2 id="before-heading" className={panel.panelTitle}>
            Before processing
          </h2>
          <p className={panel.panelCaption}>Originals are preserved before extraction.</p>
          <ul className={styles.checks}>
            <li>File type checked against its contents, not just its name</li>
            <li>Size limit enforced while reading</li>
            <li>SHA-256 calculated from the original bytes</li>
            <li>Stored under its hash; the filename never becomes a path</li>
            <li>Same bytes twice are recognized, not duplicated</li>
            <li>Every upload recorded in the audit trail</li>
          </ul>
          <p className={styles.limit}>
            Not in this demo: access policies and automatic extraction of uploaded files.
          </p>
        </aside>
      </div>

      <section className={`${panel.panel} ${styles.register}`} aria-labelledby="register-heading">
        <h2 id="register-heading" className={panel.panelTitle}>
          Evidence register
        </h2>
        <p className={panel.panelCaption}>
          Source time is immutable; normalized time belongs to the extracted event.
        </p>
        {evidence.length === 0 ? (
          <p className={styles.muted}>No evidence yet. Upload the first file above.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Source</th>
                  <th scope="col">Type</th>
                  <th scope="col">SHA-256 / provenance</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/cases/${caseId}/evidence?e=${e.id}`}>{e.id}</Link>
                    </td>
                    <td>{e.source_name}</td>
                    <td>{e.type.toUpperCase()}</td>
                    <td className={styles.hash}>
                      {e.sha256 ? `${e.sha256.slice(0, 4)}…${e.sha256.slice(-4)}` : "No file · simulated"}
                    </td>
                    <td>{STATUS_LABEL[e.processing_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
