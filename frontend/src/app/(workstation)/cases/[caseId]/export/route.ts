import { api } from "@/lib/api";

/** Passes the BI export through from the API, so the browser never talks to the API. */
export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";
  if (!/^CASE-\d{3}$/.test(caseId) || (format !== "xlsx" && format !== "zip")) {
    return Response.json({ error: { code: "invalid_request", message: "Unknown case or format.", details: {} } }, { status: 422 });
  }
  let upstream: Response;
  try {
    upstream = await api.exportFile(caseId, format);
  } catch {
    return Response.json({ error: { code: "api_unreachable", message: "The export service is not reachable.", details: {} } }, { status: 502 });
  }
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
