"use client";

import { useActionState } from "react";
import { createCase, type CreateCaseState } from "@/app/(workstation)/cases/actions";
import { CLASSIFICATIONS, UTC_OFFSETS } from "@/lib/cases";
import styles from "./CreateCaseForm.module.css";

const initial: CreateCaseState = { errors: {} };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className={styles.error}>
      {message}
    </span>
  );
}

export function CreateCaseForm() {
  const [state, action, pending] = useActionState(createCase, initial);
  const v = state.values ?? {};
  const err = state.errors;
  const describedBy = (field: keyof typeof err) => (err[field] ? `case-${field}-error` : undefined);

  return (
    <form action={action} className={styles.form} noValidate>
      {state.message && (
        <p role="alert" className={styles.alert}>
          {state.message}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="case-title">Case title</label>
        <input
          id="case-title"
          name="title"
          defaultValue={v.title}
          required
          minLength={3}
          maxLength={120}
          aria-invalid={Boolean(err.title)}
          aria-describedby={describedBy("title")}
        />
        <FieldError id="case-title-error" message={err.title} />
      </div>

      <div className={styles.field}>
        <label htmlFor="case-description">Description (optional)</label>
        <textarea
          id="case-description"
          name="description"
          defaultValue={v.description}
          maxLength={1000}
          rows={3}
          aria-describedby={describedBy("description")}
        />
        <FieldError id="case-description-error" message={err.description} />
      </div>

      <div className={styles.field}>
        <label htmlFor="case-scope">Scope (optional)</label>
        <textarea
          id="case-scope"
          name="scope"
          defaultValue={v.scope}
          maxLength={500}
          rows={2}
          placeholder="What this case tries to establish, and what it does not"
          aria-describedby={describedBy("scope")}
        />
        <FieldError id="case-scope-error" message={err.scope} />
      </div>

      <div className={styles.field}>
        <label htmlFor="case-classification">Data classification</label>
        <select
          id="case-classification"
          name="classification"
          defaultValue={v.classification ?? "synthetic"}
          aria-describedby={describedBy("classification")}
        >
          {CLASSIFICATIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <FieldError id="case-classification-error" message={err.classification} />
      </div>

      <fieldset className={styles.window}>
        <legend>Incident window</legend>
        <div className={styles.field}>
          <label htmlFor="case-start">Starts</label>
          <input
            id="case-start"
            type="datetime-local"
            name="start"
            defaultValue={v.start}
            required
            aria-invalid={Boolean(err.start)}
            aria-describedby={describedBy("start")}
          />
          <FieldError id="case-start-error" message={err.start} />
        </div>
        <div className={styles.field}>
          <label htmlFor="case-end">Ends</label>
          <input
            id="case-end"
            type="datetime-local"
            name="end"
            defaultValue={v.end}
            required
            aria-invalid={Boolean(err.end)}
            aria-describedby={describedBy("end")}
          />
          <FieldError id="case-end-error" message={err.end} />
        </div>
        <div className={styles.field}>
          <label htmlFor="case-offset">Site time (UTC offset)</label>
          <select
            id="case-offset"
            name="offset"
            defaultValue={v.offset ?? "+01:00"}
            aria-describedby={describedBy("offset")}
          >
            {UTC_OFFSETS.map((o) => (
              <option key={o} value={o}>
                UTC{o}
              </option>
            ))}
          </select>
          <FieldError id="case-offset-error" message={err.offset} />
        </div>
      </fieldset>
      <p className={styles.hint}>
        Times are stored with this offset. Ghost Protocol never assumes a timezone for you.
      </p>

      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? "Creating…" : "Create case"}
      </button>
    </form>
  );
}
