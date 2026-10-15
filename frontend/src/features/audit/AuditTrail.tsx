"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import panel from "@/components/panel.module.css";
import type { AuditEvent } from "@/lib/types";
import styles from "./audit.module.css";

export type EntityKind = "case" | "conflict" | "event" | "evidence" | "other";

export const ENTITY_LABELS: Record<EntityKind, string> = {
  case: "Case",
  conflict: "Conflict",
  event: "Timeline event",
  evidence: "Evidence",
  other: "Other",
};

/** What a free-form entity_ref points at, so rows can be grouped and linked. */
export function entityKind(ref: string): EntityKind {
  if (ref.startsWith("CASE-")) return "case";
  if (/^EV-\d+$/.test(ref)) return "event";
  if (/^E-\d+$/.test(ref)) return "evidence";
  if (/^C-\d+$/.test(ref)) return "conflict";
  return "other";
}

/** The screen for an entity, or null when the entity has no screen yet. */
export function entityHref(caseId: string, ref: string): string | null {
  switch (entityKind(ref)) {
    case "evidence":
      return `/cases/${caseId}/evidence?e=${ref}`;
    case "conflict":
      return `/cases/${caseId}/conflicts?c=${ref}`;
    case "event":
      return `/cases/${caseId}/timeline?ev=${ref}`;
    default:
      return null;
  }
}

interface Filters {
  actor: string;
  action: string;
  entity: EntityKind | "";
}

const NO_FILTERS: Filters = { actor: "", action: "", entity: "" };

/** "2026-10-11 09:02:19 UTC" — the recorded time, kept as the API states it. */
function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

export function AuditTrail({ caseId, events }: { caseId: string; events: AuditEvent[] }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const newest = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [events],
  );

  const visible = useMemo(
    () =>
      newest.filter(
        (e) =>
          (!filters.actor || e.actor === filters.actor) &&
          (!filters.action || e.action === filters.action) &&
          (!filters.entity || entityKind(e.entity_ref) === filters.entity),
      ),
    [newest, filters],
  );

  if (newest.length === 0) {
    return (
      <div className={panel.panel}>
        <p className={styles.muted}>No audit events have been recorded for {caseId} yet.</p>
      </div>
    );
  }

  const actors = [...new Set(newest.map((e) => e.actor))].sort();
  const actions = [...new Set(newest.map((e) => e.action))].sort();
  const kinds = [...new Set(newest.map((e) => entityKind(e.entity_ref)))].sort((a, b) =>
    ENTITY_LABELS[a].localeCompare(ENTITY_LABELS[b]),
  );
  const filtering = filters.actor !== "" || filters.action !== "" || filters.entity !== "";

  return (
    <>
      <div className={`${panel.panel} ${styles.filters}`} role="group" aria-label="Audit filters">
        <label htmlFor="audit-actor">
          <span>Actor</span>
          <select
            id="audit-actor"
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
          >
            <option value="">All actors</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-action">
          <span>Action</span>
          <select
            id="audit-action"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="audit-entity">
          <span>Entity type</span>
          <select
            id="audit-entity"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value as EntityKind | "" })}
          >
            <option value="">All entities</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {ENTITY_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.summary} aria-live="polite">
          {visible.length} of {newest.length} events shown
        </p>
        {filtering && (
          <button type="button" className={styles.clear} onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>No audit events match these filters</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.caption}>
              Audit events for {caseId}, newest first.
            </caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const href = entityHref(caseId, e.entity_ref);
                return (
                  <tr key={e.id}>
                    <td data-label="Time" className={panel.mono}>
                      {stamp(e.at)}
                    </td>
                    <td data-label="Actor" className={styles.actor}>
                      {e.actor}
                    </td>
                    <td data-label="Action">{e.action}</td>
                    <td data-label="Entity">
                      <span className={styles.kind}>{ENTITY_LABELS[entityKind(e.entity_ref)]}</span>
                      {href ? (
                        <Link href={href} className={styles.entity}>
                          {e.entity_ref}
                        </Link>
                      ) : (
                        <span className={styles.entityPlain}>{e.entity_ref}</span>
                      )}
                    </td>
                    <td data-label="Details" className={styles.details}>
                      {e.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
