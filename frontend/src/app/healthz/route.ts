import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Health of the whole demo: the website answered and it could reach the API. */
export async function GET() {
  const apiUp = await api.health();
  return Response.json(
    { status: apiUp ? "ok" : "degraded", web: "ok", api: apiUp ? "ok" : "unreachable" },
    { status: apiUp ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
