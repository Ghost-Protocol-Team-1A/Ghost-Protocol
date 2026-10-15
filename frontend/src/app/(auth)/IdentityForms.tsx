"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CLASSIFICATIONS } from "@/lib/cases";
import { ROLE_LABELS, ROLES } from "@/lib/identity";
import { type IdentityFormState, register, signIn } from "./actions";
import styles from "./auth.module.css";

const ROLE_HINTS = {
  investigator: "Add evidence, explore",
  reviewer: "Record decisions",
} as const;

const initial: IdentityFormState = {};

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  );
}

export function SignInForm({ defaultName = "" }: { defaultName?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const v = state.values ?? {};
  return (
    <form action={action} className={styles.form} noValidate>
      <FormError message={state.error} />
      <div className={styles.field}>
        <label htmlFor="signin-name">Your name</label>
        <input
          id="signin-name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Judge Adaeze"
          defaultValue={v.name ?? defaultName}
          required
          maxLength={40}
        />
      </div>
      <fieldset className={styles.roles}>
        <legend>Role</legend>
        {ROLES.map((role) => (
          <label key={role} className={styles.role}>
            <input type="radio" name="role" value={role} defaultChecked={(v.role ?? "reviewer") === role} />
            <span className={styles.roleName}>{ROLE_LABELS[role]}</span>
            <span className={styles.roleHint}>{ROLE_HINTS[role]}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className={`gp-btn gp-btn-lime ${styles.submit}`} disabled={pending}>
        {pending ? "Entering…" : "Enter demo workspace"}
      </button>
      <p className={styles.fine}>No password: this is a demo identity, not account security.</p>
      <p className={styles.switch}>
        Starting fresh? <Link href="/register">Create a workspace and case →</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, initial);
  const v = state.values ?? {};
  return (
    <form action={action} className={styles.form} noValidate>
      <FormError message={state.error} />
      <div className={styles.field}>
        <label htmlFor="reg-name">Your name</label>
        <input id="reg-name" name="name" autoComplete="name" placeholder="Full name" defaultValue={v.name} required maxLength={40} />
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-org">Organization (optional)</label>
        <input
          id="reg-org"
          name="organization"
          autoComplete="organization"
          placeholder="Team or company"
          defaultValue={v.organization}
          maxLength={80}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-title">First case title</label>
        <input id="reg-title" name="title" placeholder="e.g. Loading dock review" defaultValue={v.title} required maxLength={120} />
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-class">Data classification</label>
        <select id="reg-class" name="classification" defaultValue={v.classification ?? "synthetic"}>
          {CLASSIFICATIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={`gp-btn gp-btn-lime ${styles.submit}`} disabled={pending}>
        {pending ? "Setting up…" : "Continue to case scope"}
      </button>
      <p className={styles.fine}>
        Sets a demo identity, then asks for the case scope and incident window. Nothing is emailed;
        data resets with the demo.
      </p>
      <p className={styles.switch}>
        Already exploring? <Link href="/signin">Enter the demo →</Link>
      </p>
    </form>
  );
}
