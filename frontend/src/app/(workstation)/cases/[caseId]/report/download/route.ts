import { api } from "@/lib/api";

/** Passes the report file through from the API so the browser never talks to the API. */
export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const format = new URL(request.url).searchParams.get("format");
  if (!/^CASE-\d{3}$/.test(caseId) || (format !== "md" && format !== "json")) {
    return Response.json(
      { error: { code: "invalid_request", message: "Unknown case or format.", details: {} } },
      { status: 422 },
    );
  }
  let upstream: Response;
  try {
    upstream = await api.reportFile(caseId, format);
  } catch {
    return Response.json(
      { error: { code: "api_unreachable", message: "The report service is not reachable.", details: {} } },
      { status: 502 },
    );
  }
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers });
}
