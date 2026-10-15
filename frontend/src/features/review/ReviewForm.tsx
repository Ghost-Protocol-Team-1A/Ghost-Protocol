"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitReview, type ReviewState } from "@/app/(workstation)/cases/[caseId]/review-actions";
import type { ReviewStatus } from "@/lib/types";
import styles from "./review.module.css";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function ReviewForm({
  caseId,
  targetId,
  currentStatus,
}: {
  caseId: string;
  targetId: string;
  /** Pass for conflicts to allow a status decision; omit for note-only targets. */
  currentStatus?: ReviewStatus;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, {});
  const formRef = useRef<HTMLFormElement>(null);
  const noteId = `review-note-${targetId}`;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className={styles.form}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="targetId" value={targetId} />
      {currentStatus && (
        <div className={styles.field}>
          <label htmlFor={`review-status-${targetId}`}>Decision</label>
          <select id={`review-status-${targetId}`} name="status" defaultValue={currentStatus}>
            {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={`${styles.field} ${styles.grow}`}>
        <label htmlFor={noteId}>{currentStatus ? "Reason (required)" : "Reviewer note"}</label>
        <input
          id={noteId}
          name="note"
          required
          minLength={5}
          maxLength={500}
          placeholder={currentStatus ? "Why this decision?" : "What should be checked next?"}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? `${noteId}-error` : undefined}
        />
      </div>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Saving…" : currentStatus ? "Record decision" : "Add note"}
      </button>
      {state.error && (
        <p id={`${noteId}-error`} role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className={styles.saved}>
          Saved and added to the audit trail.
        </p>
      )}
    </form>
  );
}

export function ReviewHistory({ reviews }: { reviews: { actor: string; at: string; note: string; status: ReviewStatus | null }[] }) {
  if (reviews.length === 0) return null;
  return (
    <ol className={styles.history} aria-label="Review history">
      {[...reviews].reverse().map((r) => (
        <li key={`${r.at}-${r.note}`}>
          <span className={styles.meta}>
            {r.at.slice(0, 16).replace("T", " ")} UTC · {r.actor}
            {r.status && ` · ${STATUS_LABELS[r.status]}`}
          </span>
          {r.note}
        </li>
      ))}
    </ol>
  );
}
