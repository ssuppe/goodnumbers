import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ExecutiveSummary, { type Highlight } from "./ExecutiveSummary";

describe("ExecutiveSummary", () => {
  const mockHighlights: Highlight[] = [
    {
      type: "win",
      icon: "🏆",
      title: "Win Title",
      short_description: "Win description",
    },
    {
      type: "warn",
      icon: "⚠️",
      title: "Warn Title",
      short_description: "Warn description",
    },
    {
      type: "trend",
      icon: "📈",
      title: "Trend Title",
      short_description: "Trend description",
    },
  ];

  it("renders null when highlights are empty", () => {
    const { container } = render(<ExecutiveSummary highlights={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all highlights with correct content", () => {
    render(<ExecutiveSummary highlights={mockHighlights} />);

    expect(screen.getByText("Win Title")).toBeInTheDocument();
    expect(screen.getByText("Win description")).toBeInTheDocument();
    expect(screen.getByText("🏆")).toBeInTheDocument();

    expect(screen.getByText("Warn Title")).toBeInTheDocument();
    expect(screen.getByText("Warn description")).toBeInTheDocument();
    expect(screen.getByText("⚠️")).toBeInTheDocument();

    expect(screen.getByText("Trend Title")).toBeInTheDocument();
    expect(screen.getByText("Trend description")).toBeInTheDocument();
    expect(screen.getByText("📈")).toBeInTheDocument();
  });

  it("applies correct classes based on highlight type", () => {
    render(<ExecutiveSummary highlights={mockHighlights} />);

    const winCard = screen.getByText("Win Title").closest("div.rounded-xl");
    expect(winCard).toHaveClass("bg-emerald-50");

    const warnCard = screen.getByText("Warn Title").closest("div.rounded-xl");
    expect(warnCard).toHaveClass("bg-amber-50");

    const trendCard = screen.getByText("Trend Title").closest("div.rounded-xl");
    expect(trendCard).toHaveClass("bg-blue-50");
  });
});
