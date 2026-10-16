"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type ActionState,
  addClaim,
  addObservation,
  addQuestion,
  askAiToRead,
  askCase,
  type AskState,
  compileBriefing,
  decideSuggestion,
  type DraftState,
  requestDraft,
  setClock,
  signConclusion,
} from "@/app/(workstation)/cases/[caseId]/workbench-actions";
import type { Briefing, Claim, EvidenceItem, Question, Suggestion, TimelineEvent } from "@/lib/types";
import styles from "./workbench.module.css";

export function Status({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className={styles.error}>
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className={styles.ok}>
        {state.ok}
      </p>
    );
  return null;
}

const Hidden = ({ caseId, evidenceId }: { caseId: string; evidenceId?: string }) => (
  <>
    <input type="hidden" name="caseId" value={caseId} />
    {evidenceId && <input type="hidden" name="evidenceId" value={evidenceId} />}
  </>
);

/** Case date and UTC offset from the incident window, used to turn a typed clock time into ISO. */
export function windowParts(incidentStart: string): { date: string; offset: string } {
  return { date: incidentStart.slice(0, 10), offset: incidentStart.slice(19) || "+00:00" };
}

export function ObservationForm({
  caseId,
  item,
  incidentStart,
}: {
  caseId: string;
  item: EvidenceItem;
  incidentStart: string;
}) {
  const [state, action, pending] = useActionState(addObservation, {});
  const { date, offset } = windowParts(incidentStart);
  return (
    <form action={action} className={styles.form}>
      <Hidden caseId={caseId} evidenceId={item.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="offset" value={offset} />
      <label>
        What do you see or hear?
        <textarea name="description" required minLength={3} maxLength={300} placeholder="Forklift enters from the left with a pallet" />
      </label>
      <div className={styles.grid2}>
        <label>
          Timecode in the recording
          <input name="timecode" required placeholder="00:39" pattern="\d{1,2}:\d{2}(:\d{2})?" />
        </label>
        <label>
          Time it shows{item.recorded_at ? " (optional)" : ""}
          <input name="time" type="time" step="1" placeholder="21:16:00" />
        </label>
      </div>
      <p className={styles.muted}>
        {item.recorded_at
          ? `The file says recording started ${item.recorded_at.replace("T", " ").replace("Z", " UTC")}; the time is worked out from the timecode unless you give one.`
          : "This file holds no start time, so give the time the moment shows."}
      </p>
      <label className={styles.inline}>
        <input type="checkbox" name="interpretation" /> This is my reading of the footage, not something it plainly shows
      </label>
      <button className="gp-btn gp-btn-lime" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Adding…" : "Add to timeline"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function ClockForm({
  caseId,
  item,
  ownEvents,
  trustedEvents,
}: {
  caseId: string;
  item: EvidenceItem;
  ownEvents: TimelineEvent[];
  trustedEvents: TimelineEvent[];
}) {
  const [state, action, pending] = useActionState(setClock, {});
  const [method, setMethod] = useState(ownEvents.length && trustedEvents.length ? "anchors" : "declared");
  const opt = (e: TimelineEvent) => (
    <option key={e.id} value={e.id}>
      {e.id} · {e.source_time?.slice(11, 19)} · {e.description.slice(0, 40)}
    </option>
  );
  return (
    <form action={action} className={styles.form}>
      <Hidden caseId={caseId} evidenceId={item.id} />
      <fieldset className={styles.row} style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className={styles.muted} style={{ marginBottom: 8 }}>
          How does this source&apos;s clock relate to the reference?
        </legend>
        {[
          ["reference_clock", "Trusted clock"],
          ["declared", "Known error"],
          ["anchors", "Match moments"],
        ].map(([value, label]) => (
          <label key={value} className={styles.inline}>
            <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} /> {label}
          </label>
        ))}
      </fieldset>
      {method === "declared" && (
        <div className={styles.grid2}>
          <label>
            Seconds off
            <input name="seconds" type="number" min={1} max={86400} placeholder="90" />
          </label>
          <label>
            Direction
            <select name="direction" defaultValue="fast">
              <option value="fast">Clock runs fast</option>
              <option value="slow">Clock runs slow</option>
            </select>
          </label>
        </div>
      )}
      {method === "anchors" &&
        (ownEvents.length && trustedEvents.length ? (
          <>
            <p className={styles.muted}>
              Pair a moment in this source with the same moment in a trusted source. The engine takes the median of the
              differences and shows every pair.
            </p>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.grid2}>
                <label>
                  {i === 1 ? "This source" : <span className="sr-only">This source, pair {i}</span>}
                  <select name={`own${i}`} defaultValue="">
                    <option value="">{i === 1 ? "Choose a moment" : "Optional"}</option>
                    {ownEvents.map(opt)}
                  </select>
                </label>
                <label>
                  {i === 1 ? "Same moment in" : <span className="sr-only">Same moment, pair {i}</span>}
                  <select name={`ref${i}`} defaultValue="">
                    <option value="">{i === 1 ? "Choose the trusted record" : "Optional"}</option>
                    {trustedEvents.map(opt)}
                  </select>
                </label>
              </div>
            ))}
          </>
        ) : (
          <p className={styles.muted}>
            Matching needs events in this source and in a source on the trusted clock. Log observations first.
          </p>
        ))}
      <label>
        Note (optional)
        <input name="note" maxLength={300} placeholder="Checked against the site NTP server" />
      </label>
      <button className="gp-btn gp-btn-lime" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Re-timing…" : "Apply and re-run rules"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function AiReadButton({ caseId, item, configured }: { caseId: string; item: EvidenceItem; configured: boolean }) {
  const [state, action, pending] = useActionState(askAiToRead, {});
  return (
    <form action={action} className={styles.form}>
      <Hidden caseId={caseId} evidenceId={item.id} />
      <button className="gp-btn gp-btn-lime" disabled={pending || !configured} style={{ alignSelf: "flex-start" }}>
        {pending ? "Reading…" : `Ask the AI to read ${item.id}`}
      </button>
      {!configured && <p className={styles.muted}>AI is off on this server. Add events by reading the file yourself.</p>}
      <Status state={state} />
    </form>
  );
}

export function SuggestionCard({
  caseId,
  s,
  incidentStart,
}: {
  caseId: string;
  s: Suggestion;
  incidentStart: string;
}) {
  const [state, action, pending] = useActionState(decideSuggestion, {});
  const [editing, setEditing] = useState(false);
  const { date, offset } = windowParts(incidentStart);
  const decided = s.status !== "pending";
  return (
    <li className={`gp-card ${styles.ai}`} style={{ padding: "var(--gp-space-5, 20px)", borderRadius: 16, border: "1px solid var(--gp-border)", background: "var(--gp-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={styles.row} style={{ justifyContent: "space-between" }}>
        <span className={styles.aiTag}>
          AI-suggested · {s.locator}
        </span>
        <span className={styles.pickMeta}>
          {s.proposed_time ? `${s.proposed_time.slice(11, 16)}${s.approximate_seconds ? ` ±${Math.round(s.approximate_seconds / 60)} min` : ""}${s.date_assumed ? " · date from window" : ""}` : "no time stated"}
        </span>
      </div>
      <strong>{s.description}</strong>
      {s.quote && <p className={styles.quote}>“{s.quote}”</p>}
      {s.quote_verified === false && (
        <p className={styles.error}>This quote was not found word for word in the document. Check it before accepting.</p>
      )}
      {s.quote_verified === true && <p className={styles.muted}>✓ Quote found in the document</p>}
      {decided ? (
        <p className={styles.muted}>
          {s.status === "accepted" ? `Accepted as ${s.event_id}` : `Rejected${s.reason ? `: ${s.reason}` : ""}`} by {s.decided_by}
        </p>
      ) : (
        <form action={action} className={styles.form}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="suggestionId" value={s.id} />
          <input type="hidden" name="date" value={(s.proposed_time ?? incidentStart).slice(0, 10) || date} />
          <input type="hidden" name="offset" value={offset} />
          {(editing || !s.proposed_time) && (
            <div className={styles.grid2}>
              <label>
                Description
                <input name="description" defaultValue={s.description} maxLength={300} />
              </label>
              <label>
                Time{s.proposed_time ? "" : " (needed to accept)"}
                <input name="time" type="time" step="1" defaultValue={s.proposed_time?.slice(11, 19)} />
              </label>
            </div>
          )}
          <div className={styles.row}>
            <button name="action" value="accept" className="gp-btn gp-btn-lime" disabled={pending}>
              Accept
            </button>
            {!editing && s.proposed_time && (
              <button type="button" className="gp-btn gp-btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <input name="reason" placeholder="Reason to reject (optional)" maxLength={300} style={{ flex: 1, minWidth: 160 }} />
            <button name="action" value="reject" className="gp-btn gp-btn-quiet" disabled={pending}>
              Reject
            </button>
          </div>
          <Status state={state} />
        </form>
      )}
    </li>
  );
}

export function QuestionForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(addQuestion, {});
  return (
    <form action={action} className={styles.form}>
      <Hidden caseId={caseId} />
      <label>
        A question this case must answer
        <input name="text" required minLength={5} maxLength={300} placeholder="When did the pallet leave Dock 2?" />
      </label>
      <button className="gp-btn gp-btn-ghost" disabled={pending} style={{ alignSelf: "flex-start" }}>
        + Add question
      </button>
      <Status state={state} />
    </form>
  );
}

export function ClaimForm({
  caseId,
  questions,
  evidence,
  defaultQuestion,
}: {
  caseId: string;
  questions: Question[];
  evidence: EvidenceItem[];
  defaultQuestion?: string;
}) {
  const [state, action, pending] = useActionState(addClaim, {});
  return (
    <form action={action} className={styles.form}>
      <Hidden caseId={caseId} />
      <label>
        Claim
        <input name="statement" required minLength={5} maxLength={300} placeholder="The forklift entered at 06:37" />
      </label>
      <div className={styles.grid2}>
        <label>
          Answers question
          <select name="questionId" defaultValue={defaultQuestion ?? ""}>
            <option value="">None</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.id} · {q.text.slice(0, 50)}
              </option>
            ))}
          </select>
        </label>
        <label>
          State
          <select name="state" defaultValue="supported">
            <option value="supported">Supported: a cited source records it</option>
            <option value="contradicted">Contradicted: a source conflicts</option>
            <option value="inferred">Inferred: follows from two or more sources</option>
            <option value="unresolved">Unresolved: the evidence cannot settle it</option>
          </select>
        </label>
      </div>
      <label>
        Why
        <input name="rationale" required minLength={5} maxLength={500} placeholder="Recorded in the access log and on the dock camera" />
      </label>
      <p className={styles.muted}>Citations: the state must match them, or the claim is refused.</p>
      {[1, 2, 3].map((i) => (
        <div key={i} className={styles.grid3}>
          <label>
            <span className={i === 1 ? undefined : "sr-only"}>Evidence</span>
            <select name={`ev${i}`} defaultValue="">
              <option value="">{i === 1 ? "Choose evidence" : "Optional"}</option>
              {evidence.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} · {e.source_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={i === 1 ? undefined : "sr-only"}>Relationship</span>
            <select name={`rel${i}`} defaultValue="supports">
              <option value="supports">supports</option>
              <option value="contradicts">contradicts</option>
            </select>
          </label>
          <label>
            <span className={i === 1 ? undefined : "sr-only"}>Where</span>
            <input name={`loc${i}`} placeholder="row 18 · 00:39 · p1¶2" maxLength={80} />
          </label>
        </div>
      ))}
      <button className="gp-btn gp-btn-lime" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Checking…" : "Add claim"}
      </button>
      <Status state={state} />
    </form>
  );
}

function DraftButton({ caseId, questionId, configured, onDraft }: { caseId: string; questionId: string; configured: boolean; onDraft: (d: DraftState["draft"]) => void }) {
  const [state, action, pending] = useActionState(async (prev: DraftState, form: FormData) => {
    const next = await requestDraft(prev, form);
    if (next.draft) onDraft(next.draft);
    return next;
  }, {});
  return (
    <form action={action}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="questionId" value={questionId} />
      <button className="gp-btn gp-btn-quiet" disabled={pending || !configured} title={configured ? "" : "AI is off on this server"}>
        {pending ? "Drafting…" : "AI draft"}
      </button>
      {state.error && <span className={styles.error}>{state.error}</span>}
    </form>
  );
}

export function ConclusionForm({
  caseId,
  questions,
  claims,
  configured,
  signedIn,
}: {
  caseId: string;
  questions: Question[];
  claims: Claim[];
  configured: boolean;
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState(signConclusion, {});
  const [drafts, setDrafts] = useState<Record<string, { finding: string; text: string; cites: string; model: string }>>({});
  return (
    <div className={styles.form}>
      {questions.map((q) => {
        const related = claims.filter((c) => c.question_id === q.id);
        const d = drafts[q.id];
        return (
          <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16, borderBottom: "1px solid var(--gp-hairline)" }}>
            <div className={styles.row} style={{ justifyContent: "space-between" }}>
              <strong>
                <span className="gp-mono" style={{ color: "var(--gp-lime)" }}>
                  {q.id}
                </span>{" "}
                {q.text}
              </strong>
              <DraftButton
                caseId={caseId}
                questionId={q.id}
                configured={configured}
                onDraft={(draft) =>
                  draft &&
                  setDrafts((all) => ({ ...all, [q.id]: { finding: draft.finding, text: draft.text, cites: draft.cites.join(", "), model: draft.model } }))
                }
              />
            </div>
            <p className={styles.muted}>
              Claims: {related.length ? related.map((c) => `${c.id} (${c.state})`).join(" · ") : "none yet"}
            </p>
            {d && <span className={styles.aiTag}>AI draft · {d.model} · edit before signing</span>}
          </div>
        );
      })}
      <form action={action} className={styles.form} key={JSON.stringify(drafts)}>
        <Hidden caseId={caseId} />
        {questions.map((q) => {
          const d = drafts[q.id];
          return (
            <fieldset key={q.id} className={styles.form} style={{ border: "1px solid var(--gp-border)", borderRadius: 14, padding: 16, margin: 0 }}>
              <legend className="gp-mono" style={{ color: "var(--gp-lime)", padding: "0 6px" }}>
                {q.id}
              </legend>
              <input type="hidden" name="questionId" value={q.id} />
              <div className={styles.row}>
                {[
                  ["established", "Established"],
                  ["partly_established", "Partly established"],
                  ["not_established", "Not established"],
                ].map(([value, label]) => (
                  <label key={value} className={styles.inline}>
                    <input type="radio" name={`finding-${q.id}`} value={value} defaultChecked={(d?.finding ?? "not_established") === value} /> {label}
                  </label>
                ))}
              </div>
              <label>
                Answer
                <textarea name={`text-${q.id}`} required minLength={20} maxLength={2000} defaultValue={d?.text} placeholder="What the records establish, and what they leave open." />
              </label>
              <label>
                Cites (IDs, comma separated)
                <input name={`cites-${q.id}`} defaultValue={d?.cites} placeholder="CL-01, EV-012, C-01" />
              </label>
            </fieldset>
          );
        })}
        <label className={styles.inline}>
          <input type="checkbox" name="attestSources" /> I reviewed every cited source and each conflict.
        </label>
        <label className={styles.inline}>
          <input type="checkbox" name="attestUnresolved" /> Points the evidence cannot settle are stated as unresolved.
        </label>
        {!signedIn && (
          <p className={styles.error}>
            <Link href="/signin">Sign in with your name</Link> to sign. The signature records who decided.
          </p>
        )}
        <button className="gp-btn gp-btn-lime" disabled={pending || !signedIn} style={{ alignSelf: "flex-start" }}>
          {pending ? "Checking…" : "Sign conclusion"}
        </button>
        <Status state={state} />
      </form>
    </div>
  );
}

function Cites({ caseId, cites }: { caseId: string; cites: string[] }) {
  const href = (id: string) =>
    id.startsWith("EV-") || /^E-\d+-[ROA]\d+$/.test(id)
      ? `/cases/${caseId}/timeline?ev=${id}`
      : id.startsWith("C-")
        ? `/cases/${caseId}/conflicts?c=${id}`
        : id.startsWith("E-")
          ? `/cases/${caseId}/evidence?e=${id}`
          : id.startsWith("Q-") || id.startsWith("CL-")
            ? `/cases/${caseId}/questions`
            : `/cases/${caseId}/hypotheses`;
  return (
    <span>
      {cites.map((c) => (
        <Link key={c} href={href(c)} className={styles.cite}>
          {c}
        </Link>
      ))}
    </span>
  );
}

export function BriefingPanel({ caseId, initial, configured }: { caseId: string; initial: Briefing | null; configured: boolean }) {
  const [state, action, pending] = useActionState(compileBriefing, {});
  const b = state.briefing ?? initial;
  const section = (title: string, points: { text: string; cites: string[] }[]) =>
    points.length > 0 && (
      <>
        <h3 style={{ margin: "8px 0 0" }}>{title}</h3>
        <ul className={styles.list}>
          {points.map((p) => (
            <li key={p.text}>
              <p style={{ margin: "0 0 4px" }}>{p.text}</p>
              <Cites caseId={caseId} cites={p.cites} />
            </li>
          ))}
        </ul>
      </>
    );
  return (
    <div className={styles.form}>
      <div className={styles.row} style={{ justifyContent: "space-between" }}>
        <span className={styles.aiTag}>{b ? `Compiled ${b.created_at.slice(11, 16)} UTC · ${b.model} · for ${b.created_by}` : "Not compiled yet"}</span>
        <form action={action}>
          <input type="hidden" name="caseId" value={caseId} />
          <button className={b ? "gp-btn gp-btn-ghost" : "gp-btn gp-btn-lime"} disabled={pending || !configured}>
            {pending ? "Reading the case…" : b ? "Recompile" : "Compile briefing"}
          </button>
        </form>
      </div>
      <Status state={state} />
      {!configured && <p className={styles.muted}>AI is off on this server: add ANTHROPIC_API_KEY to turn it on.</p>}
      {b && (
        <>
          {section("Summary", b.summary)}
          {section("Best-supported facts", b.key_facts)}
          {section("Still unknown", b.open_questions)}
          {b.next_steps.length > 0 && (
            <>
              <h3 style={{ margin: "8px 0 0" }}>Next steps</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--gp-text-soft)" }}>
                {b.next_steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {b.removed > 0 && <p className={styles.muted}>{b.removed} points were removed because their citations did not exist.</p>}
        </>
      )}
    </div>
  );
}

export function AskPanel({ caseId, configured }: { caseId: string; configured: boolean }) {
  const [state, action, pending] = useActionState<AskState, FormData>(askCase, {});
  return (
    <div className={styles.form}>
      <form action={action} className={styles.form}>
        <input type="hidden" name="caseId" value={caseId} />
        <label>
          Ask the case
          <input name="question" required minLength={3} maxLength={500} placeholder="When did the trolley pass the bay?" disabled={!configured} />
        </label>
        <button className="gp-btn gp-btn-lime" disabled={pending || !configured} style={{ alignSelf: "flex-start" }}>
          {pending ? "Looking through the records…" : "Ask"}
        </button>
      </form>
      {state.error && <p className={styles.error}>{state.error}</p>}
      <ul className={styles.list} aria-live="polite">
        {state.answers?.map((a) => (
          <li key={a.created_at + a.question} style={{ padding: 14, borderRadius: 12, background: "var(--gp-graphite)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span className={styles.muted}>{a.question}</span>
            <p style={{ margin: 0 }}>{a.answer}</p>
            {a.cites.length > 0 ? <Cites caseId={caseId} cites={a.cites} /> : <span className={styles.muted}>No record cited: the case cannot answer this.</span>}
            {a.removed > 0 && <span className={styles.muted}>{a.removed} invented citation(s) removed.</span>}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>Answers use only this case&apos;s records. The AI never decides; it shows you where to look.</p>
    </div>
  );
}
