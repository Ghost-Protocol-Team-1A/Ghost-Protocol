import panel from "@/components/panel.module.css";
import { AuditTrail } from "@/features/audit/AuditTrail";
import { api, ApiError } from "@/lib/api";

export default async function AuditPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;

  let events;
  try {
    events = await api.audit(caseId);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return (
      <section>
        <h1 className={panel.pageTitle}>Audit trail</h1>
        <p role="alert" className={panel.error}>
          Could not load the audit trail: {message}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className={panel.pageTitle}>Audit trail</h1>
      <p className={panel.pageLead}>
        Every recorded action in this case, newest first: who acted, what happened, and which
        entity it touched.
      </p>
      <AuditTrail caseId={caseId} events={events} />
    </section>
  );
}
