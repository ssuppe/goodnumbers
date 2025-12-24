import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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

describe("ClusterEventsChart", () => {
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

  it("transforms cluster events into normalized time series", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);

    // Verify ECharts was rendered
    expect(mockReactECharts).toHaveBeenCalled();

    // Get the options passed to the chart
    const options = mockReactECharts.mock.calls[0][0].option as {
      series: Array<{
        type: string;
        markLine?: unknown;
        data: Array<[number, number]>;
      }>;
    };

    // Assert: Should have 2 series (one for each event) + threshold lines
    // We expect at least 2 series for the data
    const dataSeries = options.series.filter(
      (s) => s.type === "line" && !s.markLine,
    );
    expect(dataSeries).toHaveLength(2);

    // Assert: Check normalization
    // Event 1 (14:00 on Jan 1) -> Should be 14:00 on Jan 1, 2000
    const series1Data = dataSeries[0].data;
    const point1Time = new Date(series1Data[0][0]);
    expect(point1Time.getFullYear()).toBe(2000);
    expect(point1Time.getMonth()).toBe(0); // Jan
    expect(point1Time.getDate()).toBe(1);
    expect(point1Time.getUTCHours()).toBe(14);
    expect(point1Time.getUTCMinutes()).toBe(0);

    // Event 2 (14:15 on Jan 2) -> Should ALSO be Jan 1, 2000
    const series2Data = dataSeries[1].data;
    const point2Time = new Date(series2Data[0][0]);
    expect(point2Time.getFullYear()).toBe(2000);
    expect(point2Time.getMonth()).toBe(0);
    expect(point2Time.getDate()).toBe(1);
    expect(point2Time.getUTCHours()).toBe(14);
    expect(point2Time.getUTCMinutes()).toBe(15);
  });
});
