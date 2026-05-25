import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClusterEventsChart } from "../ClusterEventsChart";
import type { GlycemicCluster } from "@goodnumbers/types";

// Mock echarts-for-react to capture props
const mockReactECharts = vi.fn();
vi.mock("echarts-for-react", () => ({
  default: (props: unknown) => {
    mockReactECharts(props);
    return <div data-testid="echarts-mock" />;
  },
}));

interface MockOption {
  series: unknown[];
  xAxis: unknown[];
  yAxis: unknown[];
  grid: unknown[];
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
    eventCount: 1,
    activeDays: [1],
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
          { timestamp: "2023-01-01T15:00:00Z", value: 180 },
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

  it("calculates and applies a common domain to both x-axes", () => {
    render(
      <ClusterEventsChart
        cluster={mockCluster}
        units="MGDL"
        treatments={mockTreatments}
      />,
    );

    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const xAxis = options.xAxis;

    expect(xAxis).toHaveLength(2);
    expect(xAxis[0].min).toBeDefined();
    expect(xAxis[0].max).toBeDefined();
    expect(xAxis[1].min).toBeDefined();
    expect(xAxis[1].max).toBeDefined();

    // Both axes should have the SAME min and max
    expect(xAxis[0].min).toBe(xAxis[1].min);
    expect(xAxis[0].max).toBe(xAxis[1].max);

    // Check if the domain covers both glucose (14:00) and carbs (13:30)
    // 13:30 is the earliest point.
    // Padding is 30 mins.
    // So min should be 13:00.
    // 15:00 is the latest point.
    // Padding is 30 mins.
    // So max should be 15:30.

    // Note: We need to account for normalization to Year 2000.
    // 13:00 on Jan 1st 2000.
    const expectedMin = new Date("2000-01-01T13:00:00.000Z").getTime();
    const expectedMax = new Date("2000-01-01T15:30:00.000Z").getTime();

    expect(xAxis[0].min).toBe(expectedMin);
    expect(xAxis[0].max).toBe(expectedMax);
  });
});
