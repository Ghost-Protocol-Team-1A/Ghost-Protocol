/**
 * Demo identity: a name and a role chosen on the sign-in page.
 *
 * This is not authentication. There is no password and nothing is verified. The name is only
 * used to label reviews and audit entries so a judge can see their own decisions on the record.
 */

export const IDENTITY_COOKIE = "gp_identity";

export const ROLES = ["investigator", "reviewer"] as const;
export type Role = (typeof ROLES)[number];

export interface Identity {
  name: string;
  role: Role;
}

export const ROLE_LABELS: Record<Role, string> = {
  investigator: "Investigator",
  reviewer: "Reviewer",
};

const NAME_PATTERN = /^[\p{L}][\p{L} .'-]{1,39}$/u;

/** Collapse whitespace and check the name is 2–40 letters, spaces, dots, apostrophes or hyphens. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  return NAME_PATTERN.test(name) ? name : null;
}

export function parseIdentity(value: string | undefined): Identity | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Partial<Identity>;
    const name = typeof raw.name === "string" ? cleanName(raw.name) : null;
    const role = ROLES.includes(raw.role as Role) ? (raw.role as Role) : null;
    return name && role ? { name, role } : null;
  } catch {
    return null;
  }
}

export function serializeIdentity(identity: Identity): string {
  return JSON.stringify({ name: identity.name, role: identity.role });
}

/** Initials for the avatar chip: "Judge Adaeze" -> "JA". */
export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [name[0]];
  return letters.join("").toUpperCase();
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0–23. */
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
