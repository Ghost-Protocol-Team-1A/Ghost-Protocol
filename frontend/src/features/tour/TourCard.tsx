"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { TOUR, tourHref, tourIndex } from "@/lib/tour";
import styles from "./tour.module.css";

const SPOT = "gp-tour-spot";

/** The floating guide for `?tour=N`. Renders nothing when the tour is not running. */
export function TourCard() {
  const params = useSearchParams();
  const pathname = usePathname();
  const index = tourIndex(params.get("tour"));
  const step = index === null ? null : TOUR[index];
  const onPage = step !== null && step.path === pathname;

  useEffect(() => {
    if (!step?.target || !onPage) return;
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) return;
    el.classList.add(SPOT);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    return () => el.classList.remove(SPOT);
  }, [step, onPage]);

  if (index === null || step === null) return null;

  const exit = new URLSearchParams(params);
  exit.delete("tour");
  const exitHref = `${pathname}${exit.size ? `?${exit}` : ""}`;
  const last = index === TOUR.length - 1;

  return (
    <aside className={styles.card} aria-label="Guided demo" aria-live="polite">
      <div className={styles.head}>
        <span className="gp-mono">
          Guided demo · {index + 1} of {TOUR.length}
        </span>
        <Link href={exitHref} className={styles.close} aria-label="Exit the guided demo">
          ×
        </Link>
      </div>
      <div className={styles.progress} aria-hidden="true">
        {TOUR.map((s, i) => (
          <span key={i} className={i <= index ? styles.done : undefined} />
        ))}
      </div>
      <h2 className={styles.title}>{step.title}</h2>
      <p className={styles.body}>{step.body}</p>
      {!onPage && (
        <p className={styles.away}>
          You have left this stop. <Link href={tourHref(index)}>Go back to it</Link>
        </p>
      )}
      <div className={styles.actions}>
        {index > 0 ? (
          <Link href={tourHref(index - 1)} className="gp-btn gp-btn-quiet">
            Back
          </Link>
        ) : (
          <span />
        )}
        {last ? (
          <Link href={exitHref} className="gp-btn gp-btn-lime">
            Finish
          </Link>
        ) : (
          <Link href={tourHref(index + 1)} className="gp-btn gp-btn-lime">
            Next
          </Link>
        )}
      </div>
    </aside>
  );
}
