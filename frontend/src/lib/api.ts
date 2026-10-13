import type {
  ApiErrorBody,
  AuditEvent,
  CaseSummary,
  Claim,
  Conflict,
  EvidenceItem,
  Hypothesis,
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
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

export const api = {
  cases: () => get<CaseSummary[]>("/api/cases"),
  case: (id: string) => get<CaseSummary>(`/api/cases/${id}`),
  evidence: (id: string) => get<EvidenceItem[]>(`/api/cases/${id}/evidence`),
  timeline: (id: string) => get<TimelineEvent[]>(`/api/cases/${id}/timeline`),
  conflicts: (id: string) => get<Conflict[]>(`/api/cases/${id}/conflicts`),
  claims: (id: string) => get<Claim[]>(`/api/cases/${id}/claims`),
  hypotheses: (id: string) => get<Hypothesis[]>(`/api/cases/${id}/hypotheses`),
  audit: (id: string) => get<AuditEvent[]>(`/api/cases/${id}/audit`),
};

/** Format a UTC ISO time as site-local HH:MM:SS (UTC+01:00 for the demo case). */
export function localTime(iso: string | null, offsetMinutes = 60): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return d.toISOString().slice(11, 19);
}
