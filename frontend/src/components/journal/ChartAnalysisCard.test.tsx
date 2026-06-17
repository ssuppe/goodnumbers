import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChartAnalysisCard } from "./ChartAnalysisCard";

// Mock the child chart component to test in isolation
vi.mock("./charts/AgpChart", () => ({
  AgpChart: () => <div data-testid="mock-agp-chart">[Chart]</div>,
}));

// Mock InfoTooltip
vi.mock("../common/InfoTooltip", () => ({
  InfoTooltip: ({ content }: { content: React.ReactNode }) => (
    <div data-testid="info-tooltip">{content}</div>
  ),
}));

// Mock UnifiedInsightRow
vi.mock("./UnifiedInsightRow", () => ({
  UnifiedInsightRow: ({
    label,
    insight,
  }: {
    label: string;
    insight: string;
  }) => (
    <div data-testid={`insight-row-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <span>{label}</span>
      <span>{insight}</span>
    </div>
  ),
}));

const MOCK_DATA = [
  {
    time: "00:00",
    median: 100,
    mean: 100,
    p5: 80,
    p95: 120,
    p25: 90,
    p75: 110,
  },
];

const MOCK_SCORECARD = {
  avgGlucose: 150,
  stability: 85,
  timeInRange: 75,
  timeInTightRange: 40,
  timeBelowRange: 15,
};

describe("ChartAnalysisCard", () => {
  it("renders title and chart", () => {
    render(
      <ChartAnalysisCard
        title="Weekly Glucose"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    expect(screen.getByText("Weekly Glucose")).toBeInTheDocument();
    expect(screen.getByTestId("mock-agp-chart")).toBeInTheDocument();
  });

  it("renders metric cards when data is provided", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    expect(screen.getByTestId("metric-card-avg")).toBeInTheDocument();
    expect(screen.getByTestId("metric-card-tir")).toBeInTheDocument();
    expect(screen.getByTestId("metric-card-stability")).toBeInTheDocument();
    expect(screen.getByTestId("metric-card-tbr")).toBeInTheDocument();

    expect(screen.getByTestId("metric-value-avg").textContent).toBe("150");
    expect(screen.getByTestId("metric-value-tir").textContent).toBe("75");
    expect(screen.getByTestId("metric-value-stability").textContent).toBe("85");
    expect(screen.getByTestId("metric-value-tbr").textContent).toBe("15");
  });

  it("renders GMI value in detailed analysis when GMI insight is present", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[
          {
            priority: "INFO",
            note: "Your estimated GMI for this week is 6.8%.",
          },
        ]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    // Expand
    fireEvent.click(screen.getByText("View Detailed Analysis"));

    expect(
      screen.getByTestId("insight-row-gmi-(est.-a1c)"),
    ).toBeInTheDocument();
  });

  it("does not render GMI row in detailed analysis when no GMI insight is present", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    // Expand
    fireEvent.click(screen.getByText("View Detailed Analysis"));

    expect(
      screen.queryByTestId("insight-row-gmi-(est.-a1c)"),
    ).not.toBeInTheDocument();
  });

  it("toggles the Detailed Analysis section when clicked", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[
          { priority: "INFO", note: "Avg Insight" },
          { priority: "IMPORTANT", note: "TIR Insight" },
        ]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    // Should be hidden by default
    expect(
      screen.queryByText("Hide Detailed Analysis"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("insight-row-avg-glucose"),
    ).not.toBeInTheDocument();

    // Click to expand
    const toggleButton = screen.getByText("View Detailed Analysis");
    fireEvent.click(toggleButton);

    expect(screen.getByText("Hide Detailed Analysis")).toBeInTheDocument();
    expect(screen.getByTestId("insight-row-avg-glucose")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText("Hide Detailed Analysis"));
    expect(
      screen.queryByText("Hide Detailed Analysis"),
    ).not.toBeInTheDocument();
  });
});
