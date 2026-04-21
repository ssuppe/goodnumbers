import React from "react";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByTestId("metric-card-gmi")).toBeInTheDocument();

    expect(screen.getByTestId("metric-value-avg").textContent).toBe("150");
    expect(screen.getByTestId("metric-value-tir").textContent).toBe("75");
    expect(screen.getByTestId("metric-value-stability").textContent).toBe("85");
  });

  it("renders GMI value when GMI insight is present", () => {
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

    expect(screen.getByTestId("metric-value-gmi").textContent).toBe("6.8");
  });

  it("renders '--' for GMI when no insight is present", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    expect(screen.getByTestId("metric-value-gmi").textContent).toBe("--");
  });
});
