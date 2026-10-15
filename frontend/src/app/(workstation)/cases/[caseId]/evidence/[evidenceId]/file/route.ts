import { api } from "@/lib/api";

const PASS_THROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
  "content-security-policy",
  "x-content-type-options",
  "cache-control",
  "etag",
  "last-modified",
];

/** Streams an evidence file from the API so audio, video and images play in the browser. */
export async function GET(request: Request, { params }: { params: Promise<{ caseId: string; evidenceId: string }> }) {
  const { caseId, evidenceId } = await params;
  if (!/^CASE-\d{3}$/.test(caseId) || !/^E-\d{2,3}$/.test(evidenceId)) {
    return Response.json(
      { error: { code: "invalid_request", message: "Unknown case or evidence.", details: {} } },
      { status: 422 },
    );
  }
  let upstream: Response;
  try {
    upstream = await api.evidenceFile(caseId, evidenceId, request.headers.get("range"));
  } catch {
    return Response.json(
      { error: { code: "api_unreachable", message: "The evidence store is not reachable.", details: {} } },
      { status: 502 },
    );
  }
  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
