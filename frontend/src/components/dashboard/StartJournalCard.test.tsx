import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StartJournalCard from "./StartJournalCard";

// Mock lucide-react to replace icons with simple divs for the JSDOM environment
vi.mock("lucide-react", () => ({
  Sprout: (props: React.ComponentProps<"div">) => (
    <div data-testid="sprout-icon" {...props} />
  ),
  Loader2: (props: React.ComponentProps<"div">) => (
    <div data-testid="loader-icon" {...props} />
  ),
  Calendar: (props: React.ComponentProps<"div">) => (
    <div data-testid="calendar-icon" {...props} />
  ),
  ChevronDown: (props: React.ComponentProps<"div">) => (
    <div data-testid="chevron-down-icon" {...props} />
  ),
  ChevronUp: (props: React.ComponentProps<"div">) => (
    <div data-testid="chevron-up-icon" {...props} />
  ),
}));

describe("StartJournalCard", () => {
  const mockOnStart = vi.fn();

  it("renders the enabled state correctly (default)", () => {
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={false}
        error={null}
        onStart={mockOnStart}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Reflect on your week/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sprout-icon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Journal/i }),
    ).toBeEnabled();
  });

  it("renders the processing state correctly", () => {
    render(
      <StartJournalCard
        isProcessing={true}
        isSubmitting={false}
        error={null}
        onStart={mockOnStart}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Journal Processing.../i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your journal entry is being created/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Start Journal/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the submitting state correctly", () => {
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={true}
        error={null}
        onStart={mockOnStart}
      />,
    );

    const button = screen.getByRole("button", { name: /Starting.../i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it("renders an error message when an error is provided", () => {
    const errorMessage = "API connection failed.";
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={false}
        error={errorMessage}
        onStart={mockOnStart}
      />,
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
