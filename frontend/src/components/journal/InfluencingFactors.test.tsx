import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import InfluencingFactors from "./InfluencingFactors";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  CheckCircle: () => <div data-testid="check-icon" />,
  ChevronDown: () => <div data-testid="chevron-icon" />,
}));

describe("InfluencingFactors", () => {
  const mockOnChange = vi.fn();

  it("renders summary state initially (closed)", () => {
    render(<InfluencingFactors selectedFactors={[]} onChange={mockOnChange} />);

    // Should show title
    expect(screen.getByText("What happened this week?")).toBeInTheDocument();

    // Should show empty state message
    expect(
      screen.getByText(
        "You haven't added any influencing factors. Expand to add.",
      ),
    ).toBeInTheDocument();

    // Should NOT show the full list options yet
    expect(screen.queryByText("Heavy or Fatty Meal")).not.toBeInTheDocument();
  });

  it("expands to show options when header is clicked", () => {
    render(<InfluencingFactors selectedFactors={[]} onChange={mockOnChange} />);

    // Click header to expand
    fireEvent.click(screen.getByText("What happened this week?"));

    // Now options should be visible
    expect(screen.getByText("Heavy or Fatty Meal")).toBeInTheDocument();
    expect(screen.getByText("Slept Poorly")).toBeInTheDocument();
  });

  it("renders selected factors in the summary view (closed)", () => {
    const selected = ["Diet:FatProtein"];
    render(
      <InfluencingFactors selectedFactors={selected} onChange={mockOnChange} />,
    );

    // Should show the selected chip even when closed
    expect(screen.getByText("Heavy or Fatty Meal")).toBeInTheDocument();

    // Should NOT show unselected options
    expect(screen.queryByText("Slept Poorly")).not.toBeInTheDocument();
  });

  it("calls onChange when an option is toggled in expanded view", () => {
    render(<InfluencingFactors selectedFactors={[]} onChange={mockOnChange} />);

    // Expand first
    fireEvent.click(screen.getByText("What happened this week?"));

    // Click an option
    fireEvent.click(screen.getByText("Slept Poorly"));

    // Verify change
    expect(mockOnChange).toHaveBeenCalledWith(["Emotional:SleepQuality"]);
  });

  it("allows deselecting from the summary view", () => {
    const selected = ["Diet:FatProtein"];
    render(
      <InfluencingFactors selectedFactors={selected} onChange={mockOnChange} />,
    );

    // Click the visible chip in summary view
    fireEvent.click(screen.getByText("Heavy or Fatty Meal"));

    // Should call with empty array (removed)
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });
});
