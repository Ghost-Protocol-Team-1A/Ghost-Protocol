import Link from "next/link";
import type { Journey } from "@/lib/types";
import styles from "./workbench.module.css";

/** The six steps of a case, with the current one marked. Each step links to where it is done. */
export function Stepper({ journey }: { journey: Journey }) {
  return (
    <ol className={styles.stepper} aria-label="Case progress">
      {journey.steps.map((step, i) => {
        const state = step.done ? "done" : step.key === journey.current ? "now" : "todo";
        return (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`${styles.step} ${styles[state]}`}
              aria-current={state === "now" ? "step" : undefined}
              title={step.detail}
            >
              <span className={styles.num} aria-hidden="true">
                {step.done ? "✓" : i + 1}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepDetail}>{step.detail}</span>
              </span>
              <span className="sr-only">{step.done ? " (done)" : state === "now" ? " (current step)" : ""}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
