import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { AuditTrail } from "./AuditTrail";

const FIXTURE: AuditEvent[] = [
  {
    id: "A-007",
    case_id: "CASE-001",
    at: "2026-10-11T11:04:00Z",
    actor: "API",
    action: "Duplicate upload skipped",
    entity_ref: "E-08",
    details: "Same digest as E-08 · no second item created",
  },
  {
    id: "A-006",
    case_id: "CASE-001",
    at: "2026-10-11T11:03:00Z",
    actor: "API",
    action: "Evidence uploaded",
    entity_ref: "E-08",
    details: "shift-log.csv · sha256 9f86d081884c",
  },
  {
    id: "A-005",
    case_id: "CASE-001",
    at: "2026-10-11T10:02:11Z",
    actor: "BJ",
    action: "Evidence ingested",
    entity_ref: "E-06",
    details: "worker_statement.pdf",
  },
  {
    id: "A-004",
    case_id: "CASE-001",
    at: "2026-10-11T09:32:00Z",
    actor: "SYS",
    action: "Conflict created",
    entity_ref: "C-01",
    details: "RULE-DUP-001",
  },
  {
    id: "A-003",
    case_id: "CASE-001",
    at: "2026-10-11T09:31:42Z",
    actor: "SYS",
    action: "Conflict created",
    entity_ref: "EV-014",
    details: "RULE-DUP-001 · source record copy",
  },
  {
    id: "A-002",
    case_id: "CASE-001",
    at: "2026-10-11T09:20:03Z",
    actor: "BJ",
    action: "Time assumption recorded",
    entity_ref: "E-02",
    details: "Camera offset +120 s (declared)",
  },
  {
    id: "A-001",
    case_id: "CASE-001",
    at: "2026-10-11T09:00:00Z",
    actor: "BJ",
    action: "Case created",
    entity_ref: "CASE-001",
    details: "Fictional demo case",
  },
];

function serve(data: AuditEvent[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => data }),
  );
}

/** Body rows of the table, without the header row. */
function rows() {
  return screen.getAllByRole("row").slice(1);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuditTrail", () => {
  it("renders rows from the fixture, newest first, with links to each entity screen", async () => {
    serve(FIXTURE);
    render(<AuditTrail caseId="CASE-001" />);

    await screen.findByRole("table");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/cases/CASE-001/audit"),
      expect.any(Object),
    );

    const body = rows();
    expect(body).toHaveLength(7);
    expect(body[0]).toHaveTextContent("Duplicate upload skipped");
    expect(body[0]).toHaveTextContent("2026-10-11 11:04:00 UTC");
    expect(body[6]).toHaveTextContent("2026-10-11 09:00:00 UTC");
    expect(screen.getByText("RULE-DUP-001")).toBeInTheDocument();

    expect(
      within(body[0]).getByRole("link", { name: "E-08" }),
    ).toHaveAttribute("href", "/cases/CASE-001/evidence?e=E-08");
    expect(screen.getByRole("link", { name: "C-01" })).toHaveAttribute(
      "href",
      "/cases/CASE-001/conflicts?c=C-01",
    );
    expect(screen.getByRole("link", { name: "EV-014" })).toHaveAttribute(
      "href",
      "/cases/CASE-001/timeline?ev=EV-014",
    );
    // The case itself has no screen to open, so it is plain text.
    expect(screen.queryByRole("link", { name: "CASE-001" })).toBeNull();
  });

  it("reduces the rows when filters are applied, and combines them", async () => {
    serve(FIXTURE);
    render(<AuditTrail caseId="CASE-001" />);
    await screen.findByRole("table");
    expect(rows()).toHaveLength(7);

    fireEvent.change(screen.getByLabelText("Actor"), { target: { value: "API" } });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("2 of 7 events shown")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "Duplicate upload skipped" },
    });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("1 of 7 events shown")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toHaveLength(7);

    fireEvent.change(screen.getByLabelText("Entity type"), { target: { value: "conflict" } });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("C-01");
  });

  it("says so when no event matches the active filters", async () => {
    serve(FIXTURE);
    render(<AuditTrail caseId="CASE-001" />);
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("Actor"), { target: { value: "BJ" } });
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "Evidence uploaded" },
    });

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No audit events match these filters")).toBeInTheDocument();
  });

  it("shows the error state when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new ApiError(404, "case_not_found", "Case CASE-999 not found")),
    );
    render(<AuditTrail caseId="CASE-999" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not load the audit trail: Case CASE-999 not found",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a loading state while the request is in flight", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<AuditTrail caseId="CASE-001" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading the audit trail…");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
