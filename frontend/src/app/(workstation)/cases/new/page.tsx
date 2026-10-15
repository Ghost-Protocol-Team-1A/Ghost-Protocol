import panel from "@/components/panel.module.css";
import { CreateCaseForm } from "@/features/cases/CreateCaseForm";

export default function NewCasePage() {
  return (
    <section>
      <h1 className={panel.pageTitle}>Create case</h1>
      <p className={panel.pageLead}>
        Define the scope first. Evidence is added after the case exists, and every addition is
        recorded in the audit trail.
      </p>
      <div className={panel.panel}>
        <CreateCaseForm />
      </div>
    </section>
  );
}
