"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";

const CASE_ID_PATTERN = /^CASE-\d{3}$/;
const EVIDENCE_ID_PATTERN = /^E-\d{2}$/;

/** Add a held-back evidence item to the case, then show the change summary on the dashboard. */
export async function addStagedEvidence(formData: FormData) {
  const caseId = String(formData.get("caseId") ?? "");
  const evidenceId = String(formData.get("evidenceId") ?? "");
  if (!CASE_ID_PATTERN.test(caseId) || !EVIDENCE_ID_PATTERN.test(evidenceId)) {
    throw new Error("Invalid case or evidence ID.");
  }
  await api.addStaged(caseId, evidenceId);
  revalidatePath("/", "layout");
  redirect(`/dashboard?added=${evidenceId}`);
}

/** Restore the fictional demo case to its seeded state. */
export async function resetDemo() {
  await api.resetDemo();
  revalidatePath("/", "layout");
  redirect("/dashboard?reset=1");
}
