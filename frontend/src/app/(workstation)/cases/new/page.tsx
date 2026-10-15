import panel from "@/components/panel.module.css";
import { CreateCaseForm } from "@/features/cases/CreateCaseForm";
import { CLASSIFICATIONS } from "@/lib/cases";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; classification?: string; description?: string }>;
}) {
  const { title, classification, description } = await searchParams;
  const defaults: Record<string, string> = {};
  if (title) defaults.title = title.slice(0, 120);
  if (description) defaults.description = description.slice(0, 1000);
  if (CLASSIFICATIONS.some((c) => c.value === classification)) defaults.classification = classification!;

  return (
    <section>
      <p className="gp-eyebrow">New case</p>
      <h1 className={panel.pageTitle}>Create case</h1>
      <p className={panel.pageLead}>
        Define the scope first. Evidence is added after the case exists, and every addition is
        recorded in the audit trail.
      </p>
      <div className={panel.panel}>
        <CreateCaseForm defaults={defaults} />
      </div>
    </section>
  );
}
