import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateBadge } from "./StateBadge";

describe("StateBadge", () => {
  it("always shows a text label, not color alone", () => {
    render(<StateBadge state="contradicted" />);
    expect(screen.getByText("Contradicted")).toBeInTheDocument();
  });
});
