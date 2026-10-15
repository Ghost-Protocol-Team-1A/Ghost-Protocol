"use server";

import { redirect } from "next/navigation";
import { CLASSIFICATIONS } from "@/lib/cases";
import { cleanName, ROLES, type Role } from "@/lib/identity";
import { clearIdentity, setIdentity } from "@/lib/session";

export interface IdentityFormState {
  error?: string;
  values?: Record<string, string>;
}

const NAME_ERROR = "Use 2 to 40 letters. Spaces, dots, apostrophes and hyphens are fine.";

/** Choose a demo identity and enter the workspace. Not authentication: there is no password. */
export async function signIn(_prev: IdentityFormState, formData: FormData): Promise<IdentityFormState> {
  const rawName = String(formData.get("name") ?? "");
  const role = String(formData.get("role") ?? "");
  const name = cleanName(rawName);
  if (!name) return { error: NAME_ERROR, values: { name: rawName, role } };
  if (!ROLES.includes(role as Role)) return { error: "Choose a role.", values: { name: rawName, role } };
  await setIdentity({ name, role: role as Role });
  redirect("/dashboard");
}

/** Set a demo identity, then open Create case prefilled with the first case title. */
export async function register(_prev: IdentityFormState, formData: FormData): Promise<IdentityFormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    organization: String(formData.get("organization") ?? ""),
    title: String(formData.get("title") ?? ""),
    classification: String(formData.get("classification") ?? ""),
  };
  const name = cleanName(values.name);
  if (!name) return { error: NAME_ERROR, values };
  const title = values.title.trim();
  if (title.length < 3 || title.length > 120) return { error: "Give the first case a title of 3 to 120 characters.", values };
  if (!CLASSIFICATIONS.some((c) => c.value === values.classification)) {
    return { error: "Choose how sensitive this case's data is.", values };
  }
  await setIdentity({ name, role: "investigator" });
  const query = new URLSearchParams({ title, classification: values.classification });
  const organization = values.organization.replace(/\s+/g, " ").trim().slice(0, 80);
  if (organization) query.set("description", `Opened for ${organization}.`);
  redirect(`/cases/new?${query}`);
}

export async function signOut() {
  await clearIdentity();
  redirect("/");
}
