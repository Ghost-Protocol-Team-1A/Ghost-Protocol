import { JourneyBar, PageFlow } from "@/features/workbench/JourneyBar";
import { api } from "@/lib/api";

/** Every case page: where the case stands and the next step on top, Back / Continue below. */
export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const journey = /^CASE-\d{3}$/.test(caseId) ? await api.journey(caseId).catch(() => null) : null;
  return (
    <>
      {journey && <JourneyBar journey={journey} />}
      {children}
      {journey && <PageFlow caseId={caseId} />}
    </>
  );
}
