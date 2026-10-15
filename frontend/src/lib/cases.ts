import type { CaseSummary, DataClassification, NewCase } from "./types";

export const CLASSIFICATIONS: { value: DataClassification; label: string }[] = [
  { value: "synthetic", label: "Synthetic demo data" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential" },
];

export const UTC_OFFSETS = ["-05:00", "+00:00", "+01:00", "+02:00", "+03:00"] as const;

export interface NewCaseFields {
  title: string;
  description: string;
  scope: string;
  classification: string;
  start: string; // datetime-local value, e.g. "2026-10-12T08:00"
  end: string;
  offset: string; // e.g. "+01:00"
}

export type NewCaseErrors = Partial<Record<keyof NewCaseFields, string>>;

/** Validate form input and build the API payload. Times carry an explicit UTC offset. */
export function validateNewCase(f: NewCaseFields): { errors: NewCaseErrors; payload?: NewCase } {
  const errors: NewCaseErrors = {};
  const title = f.title.trim();
  if (title.length < 3 || title.length > 120) errors.title = "Use 3 to 120 characters.";
  if (f.description.length > 1000) errors.description = "Keep the description under 1000 characters.";
  if (f.scope.length > 500) errors.scope = "Keep the scope under 500 characters.";
  const classification = CLASSIFICATIONS.find((c) => c.value === f.classification)?.value;
  if (!classification) errors.classification = "Choose how sensitive this case's data is.";
  if (!(UTC_OFFSETS as readonly string[]).includes(f.offset)) errors.offset = "Choose the site's UTC offset.";

  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!pattern.test(f.start)) errors.start = "Enter when the incident window starts.";
  if (!pattern.test(f.end)) errors.end = "Enter when the incident window ends.";

  if (!errors.start && !errors.end && !errors.offset) {
    const start = `${f.start}:00${f.offset}`;
    const end = `${f.end}:00${f.offset}`;
    if (Date.parse(end) <= Date.parse(start)) errors.end = "The window must end after it starts.";
    if (Object.keys(errors).length === 0) {
      return {
        errors,
        payload: {
          title,
          description: f.description.trim(),
          scope: f.scope.trim(),
          classification: classification ?? "synthetic",
          incident_start: start,
          incident_end: end,
        },
      };
    }
  }
  return { errors };
}

export const CASE_FILTERS = [
  { id: "all", label: "All cases" },
  { id: "active", label: "Active" },
  { id: "open", label: "Open" },
  { id: "conflicts", label: "With open conflicts" },
] as const;

/** Filter the case register by a tab id from CASE_FILTERS; unknown ids show everything. */
export function filterCases(cases: CaseSummary[], filter?: string): CaseSummary[] {
  switch (filter) {
    case "active":
    case "open":
      return cases.filter((c) => c.case.status === filter);
    case "conflicts":
      return cases.filter((c) => c.open_conflicts > 0);
    default:
      return cases;
  }
}
