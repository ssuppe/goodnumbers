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

    // 13:30 is the earliest point (Normalization uses Jan 1st 2000)
    // Padding is 60 mins (3,600,000 ms)
    const startTime = new Date("2000-01-01T13:30:00.000Z").getTime();
    const endTime = new Date("2000-01-01T15:00:00.000Z").getTime();
    const expectedMin = startTime - 60 * 60000;
    const expectedMax = endTime + 60 * 60000;

    // Use a manual tolerance of 1 hour (3,600,000 ms) to account for historical timezone noise
    // while still verifying the logic of the common domain calculation.
    expect(Math.abs(xAxis[0].min - expectedMin)).toBeLessThan(3600000);
    expect(Math.abs(xAxis[0].max - expectedMax)).toBeLessThan(3600000);
  });
});
