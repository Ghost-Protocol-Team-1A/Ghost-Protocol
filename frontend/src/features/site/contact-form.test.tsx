import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContactForm, DEMO_HONEST_NOTICE } from "./contact-form";

afterEach(cleanup);

describe("ContactForm", () => {
  it("renders all form fields and submit button", () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/discussion topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit enquiry/i })
    ).toBeInTheDocument();
  });

  it("empty submit shows validation errors and does not show honest notice", () => {
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /submit enquiry/i }));

    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    expect(
      screen.getByText("Please enter your work email.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please enter your organization name.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please enter a message \(20–2000 characters\)\./i)
    ).toBeInTheDocument();

    expect(screen.queryByText(DEMO_HONEST_NOTICE)).not.toBeInTheDocument();
  });

  it("validates email format", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "invalid-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit enquiry/i }));

    expect(
      screen.getByText("Please enter a valid email address.")
    ).toBeInTheDocument();
  });

  it("validates message length minimum (at least 20 characters)", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Alex Mercer" },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "alex@example.org" },
    });
    fireEvent.change(screen.getByLabelText(/organization/i), {
      target: { value: "Acme Investigations" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Too short" },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit enquiry/i }));

    expect(
      screen.getByText(/Message must be at least 20 characters \(currently 9\)\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(DEMO_HONEST_NOTICE)).not.toBeInTheDocument();
  });

  it("valid submit shows the honest demo notice and does not pretend message was sent", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "jane@forensics.corp" },
    });
    fireEvent.change(screen.getByLabelText(/organization/i), {
      target: { value: "Forensics Integrity Unit" },
    });
    fireEvent.change(screen.getByLabelText(/discussion topic/i), {
      target: { value: "Pilot evaluation" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: {
        value: "We would like to test Ghost Protocol on internal historical cases.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit enquiry/i }));

    // Must show the exact honest notice
    expect(screen.getByText(DEMO_HONEST_NOTICE)).toBeInTheDocument();
    // Must NOT pretend the message was sent
    expect(screen.queryByText(/message sent/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thank you for contacting/i)).not.toBeInTheDocument();
  });

  it("allows user to reset form from honest notice", () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "jane@forensics.corp" },
    });
    fireEvent.change(screen.getByLabelText(/organization/i), {
      target: { value: "Forensics Unit" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: {
        value: "We would like to test Ghost Protocol on internal historical cases.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit enquiry/i }));
    expect(screen.getByText(DEMO_HONEST_NOTICE)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /edit enquiry or try again/i })
    );
    expect(screen.queryByText(DEMO_HONEST_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
  });
});
