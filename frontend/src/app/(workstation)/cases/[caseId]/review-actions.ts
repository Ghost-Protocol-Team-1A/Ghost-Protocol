"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { currentIdentity } from "@/lib/session";
import type { ReviewStatus } from "@/lib/types";

export interface ReviewState {
  error?: string;
  ok?: boolean;
}

const STATUSES: ReviewStatus[] = ["open", "under_review", "resolved", "dismissed"];

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const caseId = String(formData.get("caseId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const rawStatus = String(formData.get("status") ?? "");

  if (!/^CASE-\d{3}$/.test(caseId) || !/^(C|H)-\d{2}$/.test(targetId)) {
    return { error: "Invalid review target." };
  }
  if (note.length < 5 || note.length > 500) {
    return { error: "Give a reason of 5 to 500 characters. Every decision needs one." };
  }
  const status = STATUSES.includes(rawStatus as ReviewStatus) ? (rawStatus as ReviewStatus) : undefined;

  try {
    const identity = await currentIdentity();
    await api.createReview(caseId, { target_id: targetId, note, status, actor: identity?.name });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "The API is not reachable." };
  }
  revalidatePath(`/cases/${caseId}`, "layout");
  return { ok: true };
}
