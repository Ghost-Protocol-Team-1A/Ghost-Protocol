"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { currentIdentity } from "@/lib/session";
import type { AskAnswer, Briefing, ClaimState, Draft, Finding } from "@/lib/types";

/** Every form action returns this: an error to show, or a short confirmation. */
export interface ActionState {
  error?: string;
  ok?: string;
}

const CASE_ID = /^CASE-\d{3}$/;
const EVIDENCE_ID = /^E-\d{2,3}$/;
const STATES: ClaimState[] = ["supported", "contradicted", "inferred", "unresolved"];
const FINDINGS: Finding[] = ["established", "partly_established", "not_established"];

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function actor(): Promise<string> {
  return (await currentIdentity())?.name ?? "BJ";
}

function fail(err: unknown): ActionState {
  return { error: err instanceof ApiError ? err.message : "The API is not reachable." };
}

function ids(form: FormData): { caseId: string; evidenceId: string } | null {
  const caseId = field(form, "caseId");
  const evidenceId = field(form, "evidenceId");
  return CASE_ID.test(caseId) && EVIDENCE_ID.test(evidenceId) ? { caseId, evidenceId } : null;
}

function refresh(caseId: string) {
  revalidatePath(`/cases/${caseId}`, "layout");
}

/** "21:16" or "21:16:30" on a date, at the case's UTC offset, as ISO; null when blank. */
function localToIso(date: string, time: string, offset: string): string | null {
  if (!time) return null;
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}${offset}`;
}

export async function addObservation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const target = ids(form);
  if (!target) return { error: "Invalid evidence." };
  const timecode = field(form, "timecode");
  const description = field(form, "description");
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timecode)) return { error: "Timecode looks like 00:39 or 01:02:10." };
  if (description.length < 3) return { error: "Describe what you see or hear." };
  const sourceTime = localToIso(field(form, "date"), field(form, "time"), field(form, "offset"));
  try {
    const res = await api.addObservation(target.caseId, target.evidenceId, {
      timecode,
      description,
      source_time: sourceTime ?? undefined,
      interpretation: form.get("interpretation") === "on",
      actor: await actor(),
    });
    refresh(target.caseId);
    return { ok: `${res.event.id} added. ${res.change.conflicts_added.length ? `New conflicts: ${res.change.conflicts_added.join(", ")}.` : "No new conflicts."}` };
  } catch (err) {
    return fail(err);
  }
}

export async function setClock(_prev: ActionState, form: FormData): Promise<ActionState> {
  const target = ids(form);
  if (!target) return { error: "Invalid evidence." };
  const method = field(form, "method");
  const body: Parameters<typeof api.setClock>[2] = { method: "reference_clock", actor: await actor(), note: field(form, "note") };
  if (method === "declared") {
    const seconds = Number(field(form, "seconds"));
    if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 86_400) return { error: "Give the error in whole seconds." };
    body.method = "declared";
    body.offset_seconds = field(form, "direction") === "slow" ? -seconds : seconds;
  } else if (method === "anchors") {
    const anchors: Record<string, string> = {};
    for (const i of [1, 2, 3]) {
      const own = field(form, `own${i}`);
      const ref = field(form, `ref${i}`);
      if (own && ref) anchors[own] = ref;
    }
    if (Object.keys(anchors).length === 0) return { error: "Pair at least one moment with a trusted source." };
    body.method = "anchors";
    body.anchors = anchors;
  } else if (method !== "reference_clock") {
    return { error: "Choose how this clock relates to the reference." };
  }
  try {
    const change = await api.setClock(target.caseId, target.evidenceId, body);
    refresh(target.caseId);
    return { ok: change.trigger };
  } catch (err) {
    return fail(err);
  }
}

export async function askAiToRead(_prev: ActionState, form: FormData): Promise<ActionState> {
  const target = ids(form);
  if (!target) return { error: "Invalid evidence." };
  try {
    const made = await api.suggest(target.caseId, target.evidenceId, await actor());
    refresh(target.caseId);
    return { ok: made.length ? `${made.length} suggestions to review.` : "The AI found no timed events in this file." };
  } catch (err) {
    return fail(err);
  }
}

export async function decideSuggestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const caseId = field(form, "caseId");
  const suggestionId = field(form, "suggestionId");
  const action = field(form, "action");
  if (!CASE_ID.test(caseId) || !/^S-\d{2,3}$/.test(suggestionId)) return { error: "Invalid suggestion." };
  if (action !== "accept" && action !== "reject") return { error: "Accept or reject." };
  const time = localToIso(field(form, "date"), field(form, "time"), field(form, "offset"));
  try {
    const res = await api.decide(caseId, suggestionId, {
      action,
      description: field(form, "description") || undefined,
      proposed_time: time ?? undefined,
      reason: field(form, "reason"),
      actor: await actor(),
    });
    refresh(caseId);
    return { ok: action === "accept" ? `Added as ${res.suggestion.event_id}.` : "Rejected." };
  } catch (err) {
    return fail(err);
  }
}

export async function addQuestion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const caseId = field(form, "caseId");
  const text = field(form, "text");
  if (!CASE_ID.test(caseId)) return { error: "Invalid case." };
  if (text.length < 5) return { error: "Write the question in at least 5 characters." };
  try {
    const q = await api.addQuestion(caseId, { text, actor: await actor() });
    refresh(caseId);
    return { ok: `${q.id} added.` };
  } catch (err) {
    return fail(err);
  }
}

export async function addClaim(_prev: ActionState, form: FormData): Promise<ActionState> {
  const caseId = field(form, "caseId");
  if (!CASE_ID.test(caseId)) return { error: "Invalid case." };
  const state = field(form, "state") as ClaimState;
  if (!STATES.includes(state)) return { error: "Choose a state." };
  const links = [1, 2, 3]
    .map((i) => ({
      evidence_id: field(form, `ev${i}`),
      relationship: field(form, `rel${i}`) === "contradicts" ? ("contradicts" as const) : ("supports" as const),
      locator: field(form, `loc${i}`) || null,
    }))
    .filter((l) => EVIDENCE_ID.test(l.evidence_id));
  try {
    const claim = await api.addClaim(caseId, {
      statement: field(form, "statement"),
      question_id: field(form, "questionId") || null,
      state,
      rationale: field(form, "rationale"),
      links,
      actor: await actor(),
    });
    refresh(caseId);
    return { ok: `${claim.id} added as ${claim.state}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function signConclusion(_prev: ActionState, form: FormData): Promise<ActionState> {
  const caseId = field(form, "caseId");
  if (!CASE_ID.test(caseId)) return { error: "Invalid case." };
  const identity = await currentIdentity();
  if (!identity) return { error: "Sign in with your name before signing a conclusion." };
  const questionIds = form.getAll("questionId").map(String);
  const answers = questionIds.map((qid) => ({
    question_id: qid,
    finding: (FINDINGS.includes(field(form, `finding-${qid}`) as Finding) ? field(form, `finding-${qid}`) : "not_established") as Finding,
    text: field(form, `text-${qid}`),
    cites: field(form, `cites-${qid}`)
      .split(/[\s,]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  }));
  const short = answers.find((a) => a.text.length < 20);
  if (short) return { error: `${short.question_id}: write at least 20 characters.` };
  try {
    const signed = await api.signConclusion(caseId, {
      answers,
      actor: identity.name,
      role: identity.role,
      attest_sources_reviewed: form.get("attestSources") === "on",
      attest_unresolved_stated: form.get("attestUnresolved") === "on",
    });
    refresh(caseId);
    return { ok: `Signed as version ${signed.version}.` };
  } catch (err) {
    return fail(err);
  }
}

export interface DraftState extends ActionState {
  draft?: Draft;
}

export async function requestDraft(_prev: DraftState, form: FormData): Promise<DraftState> {
  const caseId = field(form, "caseId");
  const questionId = field(form, "questionId");
  if (!CASE_ID.test(caseId) || !/^Q-\d{2}$/.test(questionId)) return { error: "Invalid question." };
  try {
    return { draft: await api.draft(caseId, questionId, await actor()) };
  } catch (err) {
    return fail(err);
  }
}

export interface BriefingState extends ActionState {
  briefing?: Briefing;
}

export async function compileBriefing(_prev: BriefingState, form: FormData): Promise<BriefingState> {
  const caseId = field(form, "caseId");
  if (!CASE_ID.test(caseId)) return { error: "Invalid case." };
  try {
    const briefing = await api.compileBriefing(caseId, await actor());
    refresh(caseId);
    return { briefing };
  } catch (err) {
    return fail(err);
  }
}

export interface AskState extends ActionState {
  answers?: AskAnswer[];
}

export async function askCase(prev: AskState, form: FormData): Promise<AskState> {
  const caseId = field(form, "caseId");
  const question = field(form, "question");
  if (!CASE_ID.test(caseId)) return { error: "Invalid case.", answers: prev.answers };
  if (question.length < 3) return { error: "Ask a question.", answers: prev.answers };
  try {
    const answer = await api.ask(caseId, question, await actor());
    return { answers: [answer, ...(prev.answers ?? [])].slice(0, 10) };
  } catch (err) {
    return { ...fail(err), answers: prev.answers };
  }
}
