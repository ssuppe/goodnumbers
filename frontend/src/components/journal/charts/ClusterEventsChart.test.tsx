import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClusterEventsChart } from "./ClusterEventsChart";
import type { GlycemicCluster } from "@goodnumbers/types";

// Mock echarts-for-react to capture props
const mockReactECharts = vi.fn();
vi.mock("echarts-for-react", () => ({
  default: (props: unknown) => {
    mockReactECharts(props);
    return <div data-testid="echarts-mock" />;
  },
}));

// Define types for the mocked chart options to avoid 'any'
interface MockDataPoint {
  value: [number, number];
  originalDate: string;
  originalCarbs?: number;
}

interface MockSeries {
  type: string;
  name?: string;
  markLine?: unknown;
  lineStyle?: { color: string };
  emphasis?: { focus: string };
  blur?: { lineStyle: { opacity: number } };
  data: MockDataPoint[];
}

interface MockOption {
  series: MockSeries[];
  legend?: { bottom: number };
}

describe("ClusterEventsChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCluster: GlycemicCluster = {
    id: "cluster-1",
    type: "hyper",
    avgStartMinute: 840, // 14:00
    avgDurationMinutes: 60,
    eventCount: 2,
    activeDays: [1, 2],
    events: [
      {
        id: "evt-1",
        type: "hyper",
        startTime: "2023-01-01T14:00:00Z",
        endTime: "2023-01-01T15:00:00Z",
        startMinuteOfDay: 840,
        durationMinutes: 60,
        readings: [
          { timestamp: "2023-01-01T14:00:00Z", value: 180 },
          { timestamp: "2023-01-01T14:30:00Z", value: 200 },
        ],
      },
      {
        id: "evt-2",
        type: "hyper",
        startTime: "2023-01-02T14:15:00Z",
        endTime: "2023-01-02T15:15:00Z",
        startMinuteOfDay: 855,
        durationMinutes: 60,
        readings: [
          { timestamp: "2023-01-02T14:15:00Z", value: 190 },
          { timestamp: "2023-01-02T14:45:00Z", value: 210 },
        ],
      },
    ],
  };

  const mockTreatments = [
    {
      id: "t1",
      date: "2023-01-01T13:30:00Z",
      carbs: 45,
      eventType: "Meal Bolus",
    },
  ];

  it("transforms cluster events into normalized time series", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);

    expect(mockReactECharts).toHaveBeenCalled();

     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );
    expect(dataSeries).toHaveLength(2);

    // Check normalization using the new object data structure
    // Event 1
    const series1Data = dataSeries[0].data;
    const point1Time = new Date(series1Data[0].value[0]);
    expect(point1Time.getFullYear()).toBe(2000);
    expect(point1Time.getUTCHours()).toBe(14);
    expect(point1Time.getUTCMinutes()).toBe(0);

    // Event 2
    const series2Data = dataSeries[1].data;
    const point2Time = new Date(series2Data[0].value[0]);
    expect(point2Time.getFullYear()).toBe(2000);
    expect(point2Time.getUTCHours()).toBe(14);
    expect(point2Time.getUTCMinutes()).toBe(15);
  });

  it("assigns distinct colors to different events", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );

    const color1 = dataSeries[0].lineStyle?.color;
    const color2 = dataSeries[1].lineStyle?.color;

    expect(color1).toBeDefined();
    expect(color2).toBeDefined();
    expect(color1).not.toBe(color2);
  });

  it("configures emphasis and blur states for spotlight effect", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );

    const series1 = dataSeries[0];
    expect(series1.emphasis?.focus).toBe("series");
    expect(series1.blur?.lineStyle?.opacity).toBeLessThan(1);
  });

  it("names series with the date (e.g. Sun, Jan 1)", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );

    // Event 1 is 2023-01-01 (Sunday)
    // We expect format like "Sun, Jan 1"
    expect(dataSeries[0].name).toContain("Sun");
    expect(dataSeries[0].name).toContain("Jan 1");
  });

  it("configures the legend at the bottom", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;

    expect(options.legend).toBeDefined();
    expect(options.legend?.bottom).toBeDefined();
  });

  it("includes original date information in data points for tooltips", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );

    const point = dataSeries[0].data[0];
    // Check for object structure with originalDate
    expect(point).toHaveProperty("value");
    expect(point).toHaveProperty("originalDate");
    // Should contain the full date string
    expect(new Date(point.originalDate).toISOString()).toContain("2023-01-01");
  });

  it("sorts series by date in the legend", () => {
    // Create a cluster with events out of order
    const unsortedCluster: GlycemicCluster = {
      ...mockCluster,
      events: [
        mockCluster.events[1], // Jan 2
        mockCluster.events[0], // Jan 1
      ],
    };

    render(<ClusterEventsChart cluster={unsortedCluster} units="MGDL" />);
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );

    // Should be sorted by date (Jan 1 first)
    expect(dataSeries[0].name).toContain("Jan 1");
    expect(dataSeries[1].name).toContain("Jan 2");
  });

  it("renders treatment (carb) bars when provided", () => {
    render(
      <ClusterEventsChart
        cluster={mockCluster}
        units="MGDL"
        treatments={mockTreatments}
      />,
    );
     
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;

    // Find bar series
    const barSeries = options.series.filter((s) => s.type === "bar");
    expect(barSeries.length).toBeGreaterThan(0);

    // Check if the carb data is present
    const carbPoint = barSeries[0].data[0];
    expect(carbPoint.value[1]).toBe(45); // 45g carbs
    expect(carbPoint).toHaveProperty("originalCarbs", 45);
  });
});
