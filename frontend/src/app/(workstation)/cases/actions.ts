"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { type NewCaseErrors, validateNewCase } from "@/lib/cases";

export interface CreateCaseState {
  errors: NewCaseErrors;
  message?: string;
  values?: Record<string, string>;
}

export async function createCase(_prev: CreateCaseState, formData: FormData): Promise<CreateCaseState> {
  const fields = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    start: String(formData.get("start") ?? ""),
    end: String(formData.get("end") ?? ""),
    offset: String(formData.get("offset") ?? ""),
  };
  const { errors, payload } = validateNewCase(fields);
  if (!payload) return { errors, values: fields };

  let caseId: string;
  try {
    caseId = (await api.createCase(payload)).case.id;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "The API is not reachable.";
    return { errors: {}, message: `Could not create the case: ${message}`, values: fields };
  }
  revalidatePath("/", "layout");
  redirect(`/cases/${caseId}/evidence`);
}
