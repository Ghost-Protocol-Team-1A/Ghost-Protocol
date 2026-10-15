import panel from "@/components/panel.module.css";
import { AuditTrail } from "@/features/audit/AuditTrail";

export default async function AuditPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <section>
      <h1 className={panel.pageTitle}>Audit trail</h1>
      <p className={panel.pageLead}>
        Every recorded action in this case, newest first: who acted, what happened, and which
        entity it touched.
      </p>
      <AuditTrail caseId={caseId} />
    </section>
  );
}
