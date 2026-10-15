"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { checkUpload } from "@/lib/intake";
import type { EvidenceUpload } from "@/lib/types";

export interface UploadState {
  error?: string;
  result?: EvidenceUpload;
}

export async function uploadEvidence(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!/^CASE-\d{3}$/.test(caseId)) return { error: "Invalid case." };
  const file = formData.get("file");
  const problem = checkUpload(file instanceof File ? file : null);
  if (problem || !(file instanceof File)) return { error: problem ?? "Choose a file to upload." };

  try {
    const result = await api.uploadEvidence(caseId, file);
    revalidatePath(`/cases/${caseId}`, "layout");
    return { result };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "The API is not reachable." };
  }
}
