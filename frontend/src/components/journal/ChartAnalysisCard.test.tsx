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

interface MockRowProps {
  label: string;
  value: string;
  insight: React.ReactNode;
}

// Mock UnifiedInsightRow to simplify assertions
vi.mock("./UnifiedInsightRow", () => ({
  UnifiedInsightRow: ({ label, value, insight }: MockRowProps) => (
    <div data-testid="insight-row">
      <div data-testid="row-label">{label}</div>
      <div data-testid="row-value">{value}</div>
      <div data-testid="row-insight">{insight}</div>
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
};

const MOCK_INSIGHTS = [
  { priority: "IMPORTANT", note: "Your estimated GMI for this week is 6.8%." },
  { priority: "INFO", note: "Your average glucose is 150 mg/dL." },
  {
    priority: "CRITICAL",
    note: "**Celebrate the Win:** No hypos.", // Matches Hypo
  },
  {
    priority: "IMPORTANT",
    note: "**Goal Reached:** Time in Range is great.", // Matches TIR
  },
];

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

  it("renders scorecard rows when data is provided", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    const labels = screen
      .getAllByTestId("row-label")
      .map((el) => el.textContent);
    expect(labels).toContain("Avg Glucose");
    expect(labels).toContain("Stability");
    expect(labels).toContain("Time In Range");
    expect(labels).toContain("Time In Tight Range");
    // GMI not rendered because no matching insight
    expect(labels).not.toContain("GMI (Est. A1c)");
  });

  it("renders GMI row when GMI insight is present", () => {
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

    const labels = screen
      .getAllByTestId("row-label")
      .map((el) => el.textContent);
    expect(labels).toContain("GMI (Est. A1c)");

    // Check extracted value
    const values = screen
      .getAllByTestId("row-value")
      .map((el) => el.textContent);
    expect(values).toContain("6.8"); // Extracted from regex
  });

  it("matches insights to correct rows", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={MOCK_INSIGHTS}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    const rows = screen.getAllByTestId("insight-row");

    // Check Avg Glucose Row
    const avgRow = rows.find(
      (r) =>
        r.querySelector('[data-testid="row-label"]')?.textContent ===
        "Avg Glucose",
    );
    expect(
      avgRow?.querySelector('[data-testid="row-insight"]')?.textContent,
    ).toContain("average glucose is 150");

    // Check Stability Row (matches Hypo insight)
    const stabRow = rows.find(
      (r) =>
        r.querySelector('[data-testid="row-label"]')?.textContent ===
        "Stability",
    );
    expect(
      stabRow?.querySelector('[data-testid="row-insight"]')?.textContent,
    ).toContain("Celebrate the Win");

    // Check TIR Row
    const tirRow = rows.find(
      (r) =>
        r.querySelector('[data-testid="row-label"]')?.textContent ===
        "Time In Range",
    );
    expect(
      tirRow?.querySelector('[data-testid="row-insight"]')?.textContent,
    ).toContain("Goal Reached");
  });

  it("uses fallback text when insights are missing", () => {
    render(
      <ChartAnalysisCard
        title="Test"
        data={MOCK_DATA}
        units="MGDL"
        insights={[]}
        scoreCardData={MOCK_SCORECARD}
      />,
    );

    const rows = screen.getAllByTestId("insight-row");

    // Check Avg Glucose Fallback
    const avgRow = rows.find(
      (r) =>
        r.querySelector('[data-testid="row-label"]')?.textContent ===
        "Avg Glucose",
    );
    expect(
      avgRow?.querySelector('[data-testid="row-insight"]')?.textContent,
    ).toContain("Your average blood sugar over the last 7 days");
  });
});
