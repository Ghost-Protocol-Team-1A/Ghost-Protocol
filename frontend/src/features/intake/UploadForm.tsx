"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { uploadEvidence, type UploadState } from "@/app/(workstation)/cases/[caseId]/intake/actions";
import { ACCEPT_ATTRIBUTE, ACCEPTED_GROUPS, MAX_UPLOAD_MB } from "@/lib/intake";
import styles from "./intake.module.css";

export function UploadForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadEvidence, {});
  const formRef = useRef<HTMLFormElement>(null);
  const r = state.result;

  return (
    <div>
      <form ref={formRef} action={action} className={styles.form}>
        <input type="hidden" name="caseId" value={caseId} />
        <span className={styles.arrow} aria-hidden="true">
          ↑
        </span>
        <label htmlFor="evidence-file" className={styles.dropTitle}>
          Add evidence to {caseId}
        </label>
        <p className={styles.types}>Video · audio · images · documents · logs, up to {MAX_UPLOAD_MB} MB</p>
        <details className={styles.formats}>
          <summary>Accepted formats</summary>
          <dl>
            {Object.entries(ACCEPTED_GROUPS).map(([group, exts]) => (
              <div key={group}>
                <dt>{group}</dt>
                <dd>{exts.join(" · ").toUpperCase()}</dd>
              </div>
            ))}
          </dl>
        </details>
        <input
          id="evidence-file"
          name="file"
          type="file"
          required
          accept={ACCEPT_ATTRIBUTE}
          className={styles.file}
          aria-describedby={state.error ? "upload-error" : undefined}
        />
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Uploading and hashing…" : "Upload evidence"}
        </button>
        {state.error && (
          <p id="upload-error" role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
      </form>

      {r && (
        <div role="status" className={styles.result}>
          <p className={styles.resultTitle}>
            {r.duplicate ? `Already in this case as ${r.id}` : `Added as ${r.id}`} · {r.source_name}
          </p>
          {r.duplicate && (
            <p className={styles.note}>The same bytes were uploaded before, so no second copy was created.</p>
          )}
          <dl className={styles.facts}>
            <dt>SHA-256</dt>
            <dd className={styles.hash}>{r.sha256}</dd>
            <dt>Size</dt>
            <dd>{r.size_bytes?.toLocaleString()} bytes</dd>
            <dt>Type</dt>
            <dd>{r.type}</dd>
            <dt>Status</dt>
            <dd>
              {r.processing_status}
              {r.processing_status === "queued" && " · stored and hashed; event extraction has not run"}
            </dd>
          </dl>
          <Link href={`/cases/${caseId}/evidence?e=${r.id}`}>Open {r.id} in the evidence viewer →</Link>
        </div>
      )}
    </div>
  );
}
