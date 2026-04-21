import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StartJournalCard from "./StartJournalCard";

// Mock lucide-react to replace icons with simple divs for the JSDOM environment
vi.mock("lucide-react", () => ({
  // The 'Sprout' icon in the enabled and disabled states
  Sprout: (props: React.ComponentProps<"div">) => (
    <div data-testid="sprout-icon" {...props} />
  ),
  // The 'Loader2' icon in the submitting state
  Loader2: (props: React.ComponentProps<"div">) => (
    <div data-testid="loader-icon" {...props} />
  ),
}));

describe("StartJournalCard", () => {
  const mockOnClick = vi.fn();

  it("renders the enabled state correctly (default)", () => {
    // @ts-expect-error: 'isProcessing' prop missing in current implementation
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={false}
        error={null}
        onClick={mockOnClick}
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
    // @ts-expect-error: 'isProcessing' prop missing in current implementation
    render(
      <StartJournalCard
        isProcessing={true}
        isSubmitting={false}
        error={null}
        onClick={mockOnClick}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Journal Processing.../i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your journal entry is being created/i),
    ).toBeInTheDocument();
    // Loader should be visible (reusing Loader2 icon usually, or checking text if simpler)
    // The plan says "large Spinner", let's assume it uses Loader2
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    // Button should NOT be present
    expect(
      screen.queryByRole("button", { name: /Start Journal/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the submitting state correctly", () => {
    // @ts-expect-error: 'isProcessing' prop missing in current implementation
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={true}
        error={null}
        onClick={mockOnClick}
      />,
    );

    const button = screen.getByRole("button", { name: /Starting.../i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it("renders an error message when an error is provided", () => {
    const errorMessage = "API connection failed.";
    // @ts-expect-error: 'isProcessing' prop missing in current implementation
    render(
      <StartJournalCard
        isProcessing={false}
        isSubmitting={false}
        error={errorMessage}
        onClick={mockOnClick}
      />,
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
