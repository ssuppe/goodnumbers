import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StartJournalCard from "./StartJournalCard";
import { addDays, format } from "date-fns";

// Mock lucide-react to replace icons with simple divs for the JSDOM environment
vi.mock("lucide-react", () => ({
  // The 'Sprout' icon in the enabled and disabled states
  Sprout: (props) => <div data-testid="sprout-icon" {...props} />,
  // The 'Loader2' icon in the submitting state
  Loader2: (props) => <div data-testid="loader-icon" {...props} />,
}));

describe("StartJournalCard", () => {
  const mockOnClick = vi.fn();

  it("renders the enabled state correctly", () => {
    render(
      <StartJournalCard
        isEnabled={true}
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

  it("renders the disabled state correctly", () => {
    const today = new Date();
    const unlockDate = addDays(today, 3);
    render(
      <StartJournalCard
        isEnabled={false}
        isSubmitting={false}
        error={null}
        onClick={mockOnClick}
        latestJournalDate={today}
      />,
    );

    expect(
      screen.getByText(/Your next journal unlocks on/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(format(unlockDate, "MMMM d, yyyy")),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sprout-icon")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Journal/i }),
    ).toBeDisabled();
  });

  it("renders the submitting state correctly", () => {
    render(
      <StartJournalCard
        isEnabled={true}
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
    render(
      <StartJournalCard
        isEnabled={true}
        isSubmitting={false}
        error={errorMessage}
        onClick={mockOnClick}
      />,
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
