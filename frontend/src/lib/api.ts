import type {
  AiStatus,
  Answer,
  ApiErrorBody,
  AskAnswer,
  AuditEvent,
  Briefing,
  CaseSummary,
  ChangeSummary,
  Claim,
  ClaimState,
  Conclusion,
  Conflict,
  Draft,
  EvidenceItem,
  EvidenceUpload,
  Hypothesis,
  Journey,
  NewCase,
  NewReview,
  OriginalRecord,
  Question,
  StagedItem,
  Suggestion,
  TimelineEvent,
} from "./types";

// Server-side only: pages, server actions and route handlers call the API; browsers never do.
const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error.code ?? "http_error",
      body?.error.message ?? `Request failed (${res.status})`,
    );
  }
  return (await res.json()) as T;
}

const get = <T>(path: string) => request<T>(path);

const post = <T>(path: string, body: unknown) => request<T>(path, "POST", body);

export const api = {
  cases: () => get<CaseSummary[]>("/api/cases"),
  case: (id: string) => get<CaseSummary>(`/api/cases/${id}`),
  evidence: (id: string) => get<EvidenceItem[]>(`/api/cases/${id}/evidence`),
  timeline: (id: string) => get<TimelineEvent[]>(`/api/cases/${id}/timeline`),
  conflicts: (id: string) => get<Conflict[]>(`/api/cases/${id}/conflicts`),
  claims: (id: string) => get<Claim[]>(`/api/cases/${id}/claims`),
  hypotheses: (id: string) => get<Hypothesis[]>(`/api/cases/${id}/hypotheses`),
  audit: (id: string) => get<AuditEvent[]>(`/api/cases/${id}/audit`),
  staged: (id: string) => get<StagedItem[]>(`/api/cases/${id}/staged`),
  changes: (id: string) => get<ChangeSummary[]>(`/api/cases/${id}/changes`),
  addStaged: (id: string, evidenceId: string) =>
    request<ChangeSummary>(`/api/cases/${id}/staged/${evidenceId}`, "POST"),
  createReview: (id: string, body: NewReview) =>
    request<Conflict | Hypothesis>(`/api/cases/${id}/reviews`, "POST", body),
  /** Upload one evidence file. Same bytes twice return the existing item with duplicate=true. */
  uploadEvidence: async (id: string, file: File): Promise<EvidenceUpload> => {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await fetch(`${BASE}/api/cases/${id}/evidence`, { method: "POST", body: form, cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(res.status, body?.error.code ?? "http_error", body?.error.message ?? `Upload failed (${res.status})`);
    }
    return (await res.json()) as EvidenceUpload;
  },
  createCase: (body: NewCase) => request<CaseSummary>("/api/cases", "POST", body),
  resetDemo: () => request<{ status: string }>("/api/demo/reset", "POST"),
  /** Whether the report export endpoint answers; false when the API is down or it 501s. */
  reportAvailable: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/api/cases/${id}/report?format=json`, { cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  },
  /** Download link for the report. Served by the website, which fetches it from the API. */
  reportUrl: (id: string, format: "md" | "json") => `/cases/${id}/report/download?format=${format}`,
  /** Raw report response from the API, for the download route to pass through. */
  journey: (id: string) => get<Journey>(`/api/cases/${id}/journey`),
  questions: (id: string) => get<Question[]>(`/api/cases/${id}/questions`),
  addQuestion: (id: string, body: { text: string; actor?: string }) => post<Question>(`/api/cases/${id}/questions`, body),
  addClaim: (
    id: string,
    body: {
      statement: string;
      question_id?: string | null;
      state: ClaimState;
      rationale: string;
      links: { evidence_id: string; locator?: string | null; relationship: "supports" | "contradicts" }[];
      actor?: string;
    },
  ) => post<Claim>(`/api/cases/${id}/claims`, body),
  conclusions: (id: string) => get<Conclusion[]>(`/api/cases/${id}/conclusions`),
  signConclusion: (
    id: string,
    body: { answers: Answer[]; actor: string; role: string; attest_sources_reviewed: boolean; attest_unresolved_stated: boolean },
  ) => post<Conclusion>(`/api/cases/${id}/conclusions`, body),
  addObservation: (
    id: string,
    evidenceId: string,
    body: { timecode: string; description: string; source_time?: string; interpretation?: boolean; actor?: string },
  ) => post<{ event: TimelineEvent; change: ChangeSummary }>(`/api/cases/${id}/evidence/${evidenceId}/observations`, body),
  setClock: (
    id: string,
    evidenceId: string,
    body: { method: "reference_clock" | "declared" | "anchors"; offset_seconds?: number; anchors?: Record<string, string>; note?: string; actor?: string },
  ) => request<ChangeSummary>(`/api/cases/${id}/evidence/${evidenceId}/clock`, "PUT", body),
  aiStatus: () => get<AiStatus>("/api/ai/status"),
  suggestions: (id: string) => get<Suggestion[]>(`/api/cases/${id}/suggestions`),
  suggest: (id: string, evidenceId: string, actor?: string) =>
    post<Suggestion[]>(`/api/cases/${id}/evidence/${evidenceId}/suggestions`, { actor }),
  decide: (
    id: string,
    suggestionId: string,
    body: { action: "accept" | "reject"; description?: string; proposed_time?: string; reason?: string; actor?: string },
  ) => post<{ suggestion: Suggestion; change: ChangeSummary | null }>(`/api/cases/${id}/suggestions/${suggestionId}`, body),
  briefing: async (id: string): Promise<Briefing | null> => {
    try {
      return await get<Briefing>(`/api/cases/${id}/briefing`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "no_briefing") return null;
      throw err;
    }
  },
  compileBriefing: (id: string, actor?: string) => post<Briefing>(`/api/cases/${id}/briefing`, { actor }),
  ask: (id: string, question: string, actor?: string) => post<AskAnswer>(`/api/cases/${id}/ask`, { question, actor }),
  draft: (id: string, questionId: string, actor?: string) =>
    post<Draft>(`/api/cases/${id}/conclusion-draft`, { question_id: questionId, actor }),
  exportFile: (id: string, format: "xlsx" | "zip") =>
    fetch(`${BASE}/api/cases/${id}/export?format=${format}`, { cache: "no-store" }),
  reportFile: (id: string, format: "md" | "json") =>
    fetch(`${BASE}/api/cases/${id}/report?format=${format}`, { cache: "no-store" }),
  /** Original bytes of an evidence item, passing a Range header through for media seeking. */
  evidenceFile: (id: string, evidenceId: string, range: string | null) =>
    fetch(`${BASE}/api/cases/${id}/evidence/${evidenceId}/file`, {
      cache: "no-store",
      headers: range ? { range } : undefined,
    }),
  /** API liveness, for the website health check. */
  health: async (): Promise<boolean> => {
    try {
      return (await fetch(`${BASE}/health`, { cache: "no-store" })).ok;
    } catch {
      return false;
    }
  },
  /** Original log rows, or null when the item has no stored file (simulated extraction). */
  original: async (id: string, evidenceId: string): Promise<OriginalRecord | null> => {
    try {
      return await get<OriginalRecord>(`/api/cases/${id}/evidence/${evidenceId}/original`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "original_not_available") return null;
      throw err;
    }
  },
};

/** Format a UTC ISO time as site-local HH:MM:SS (UTC+01:00 for the demo case). */
export function localTime(iso: string | null, offsetMinutes = 60): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return d.toISOString().slice(11, 19);
}
