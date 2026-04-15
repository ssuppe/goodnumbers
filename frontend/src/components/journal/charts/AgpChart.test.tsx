import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
// @ts-expect-error - implementation exists
import { AgpChart } from "./AgpChart";

// Capture the raw option object to test functions like renderItem
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedOption: any = null;

// Mock echarts-for-react
vi.mock("echarts-for-react", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ option }: { option: any }) => {
    capturedOption = option;
    return <div data-testid="mock-echarts" />;
  },
}));

// Mock resize observer
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const MOCK_DATA = [
  {
    time: "00:00",
    median: 100,
    mean: 105,
    p5: 80,
    p95: 140,
    p25: 90,
    p75: 120,
  },
  {
    time: "00:30",
    median: 102,
    mean: 106,
    p5: 82,
    p95: 142,
    p25: 92,
    p75: 122,
  },
];

interface MockSeries {
  name?: string;
  type?: string;
  markArea?: { data: { yAxis: number }[][] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderItem?: (params: any, api: any) => any;
}

describe("AgpChart", () => {
  beforeEach(() => {
    capturedOption = null;
  });

  it("renders without crashing", () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);
    expect(screen.getByTestId("mock-echarts")).toBeInTheDocument();
  });

  it("passes correct options to ECharts", () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);

    expect(capturedOption).toBeDefined();
    expect(capturedOption).toHaveProperty("series");
    expect(capturedOption).toHaveProperty("xAxis");
    expect(capturedOption).toHaveProperty("yAxis");

    const customSeries = capturedOption.series.filter(
      (s: MockSeries) => s.type === "custom",
    );
    expect(customSeries.length).toBeGreaterThanOrEqual(2);

    const medianSeries = capturedOption.series.find(
      (s: MockSeries) => s.name === "Median",
    );
    expect(medianSeries).toBeDefined();

    // Verify Target Range markArea exists
    const seriesWithMarkArea = capturedOption.series.find(
      (s: MockSeries) => s.markArea,
    );
    expect(seriesWithMarkArea).toBeDefined();
    expect(seriesWithMarkArea.markArea.data[0][0].yAxis).toBe(70);
    expect(seriesWithMarkArea.markArea.data[0][1].yAxis).toBe(180);
  });

  it('renders "No Data" state if data is empty', () => {
    render(<AgpChart data={[]} units="MGDL" />);
    expect(screen.getByText(/No AGP data available/i)).toBeInTheDocument();
    expect(screen.queryByTestId("mock-echarts")).not.toBeInTheDocument();
  });

  it("uses MMOL units in yAxis name when requested", () => {
    render(<AgpChart data={MOCK_DATA} units="MMOL" />);
    expect(capturedOption.yAxis.name).toContain("mmol/L");
  });

  it("renders bars as rounded rectangles with padding", () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);

    const bandSeries = capturedOption.series.find(
      (s: MockSeries) => s.name === "5th-95th Percentile",
    );
    expect(bandSeries).toBeDefined();

    // Mock API for renderItem
    const mockApi = {
      value: (idx: number) => (idx === 0 ? 0 : idx === 1 ? 80 : 140), // x=0, low=80, high=140
      coord: (pt: number[]) => [100, 200 - pt[1]], // Simple mock coord: x=100, y=200-val
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: (obj: any) => obj,
      size: () => [50, 50], // width 50
    };

    // Mock Params
    const mockParams = {
      coordSys: { width: 1000 },
      dataIndex: 0,
    };

    // Invoke renderItem
    const shape = bandSeries.renderItem(mockParams, mockApi);

    // Assertions for Rounded Rect
    // Current implementation returns 'polygon', so this should fail
    expect(shape.type).toBe("rect");
    expect(shape.shape).toHaveProperty("r"); // Check for radius
    expect(shape.shape.r).toEqual([2, 2, 2, 2]); // Check for specific subtle radius
  });

  it("formats tooltip with friendly labels and colored dots", () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);

    const formatter = capturedOption.tooltip.formatter;
    expect(formatter).toBeDefined();

    // Mock params passed by ECharts to formatter
    const params = [{ dataIndex: 0 }];
    const tooltipHtml = formatter(params);

    // Check for friendly labels
    expect(tooltipHtml).toContain("50% of Readings");
    expect(tooltipHtml).toContain("90% of Readings");

    // Check for values from MOCK_DATA[0]
    // { time: '00:00', median: 100, mean: 105, p5: 80, p95: 140, p25: 90, p75: 120 }
    expect(tooltipHtml).toContain("100"); // Median
    expect(tooltipHtml).toContain("90 - 120"); // 50% range (p25-p75)
    expect(tooltipHtml).toContain("80 - 140"); // 90% range (p5-p95)

    // Check for visual elements (colored dots)
    // Median Color (Mesa Primary)
    expect(tooltipHtml).toContain("#D9775B");
  });
});
