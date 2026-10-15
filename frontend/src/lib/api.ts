import type {
  ApiErrorBody,
  AuditEvent,
  CaseSummary,
  ChangeSummary,
  Claim,
  Conflict,
  EvidenceItem,
  EvidenceUpload,
  Hypothesis,
  NewCase,
  NewReview,
  OriginalRecord,
  StagedItem,
  TimelineEvent,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
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
  /** Browser download URL for the exported report. */
  reportUrl: (id: string, format: "md" | "json") => `${BASE}/api/cases/${id}/report?format=${format}`,
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
