/** @vitest-environment jsdom */
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

// Mock resize observer
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

interface VisualMapPiece {
  gt?: number;
  lt?: number;
  gte?: number;
  lte?: number;
  color: string;
}

interface VisualMap {
  pieces: VisualMapPiece[];
  seriesIndex: number;
}

interface MockOption {
  series: { data: { value: number[] }[] }[];
  visualMap: VisualMap[];
}

describe("ClusterEventsChart Stability & Correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCluster: GlycemicCluster = {
    id: "cluster-1",
    type: "hyper",
    avgStartMinute: 0,
    avgDurationMinutes: 0,
    eventCount: 1,
    activeDays: [1],
    events: [
      {
        id: "evt-1",
        type: "hyper",
        startTime: "2023-01-01T10:00:00Z",
        endTime: "2023-01-01T11:00:00Z",
        startMinuteOfDay: 600,
        durationMinutes: 60,
        readings: [
          { timestamp: "2023-01-01T10:00:00Z", value: 180 },
          { timestamp: "2023-01-01T10:30:00Z", value: 200 },
          { timestamp: "2023-01-01T11:00:00Z", value: 180 },
        ],
      },
    ],
  };

  it("filters out NaN values and timestamps to prevent coordinate crashes", () => {
    const clusterWithNaN: GlycemicCluster = {
      ...mockCluster,
      events: [
        {
          ...mockCluster.events[0],
          readings: [
            { timestamp: "2023-01-01T10:00:00Z", value: 180 },
            { timestamp: "INVALID", value: 200 }, // Bad timestamp
            { timestamp: "2023-01-01T11:00:00Z", value: NaN }, // Bad value
            { timestamp: "2023-01-01T11:30:00Z", value: 190 },
          ],
        },
      ],
    };

    render(<ClusterEventsChart cluster={clusterWithNaN} units="MGDL" />);
    
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const seriesData = options.series[0].data;

    // Should only have 2 valid points (first and last)
    expect(seriesData).toHaveLength(2);
    seriesData.forEach(point => {
      expect(isNaN(point.value[0])).toBe(false);
      expect(isNaN(point.value[1])).toBe(false);
    });
  });

  it("generates continuous, non-overlapping visualMap pieces to prevent 'coord' undefined errors", () => {
    render(<ClusterEventsChart cluster={mockCluster} units="MGDL" />);
    
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const pieces = options.visualMap[0].pieces;

    // Should have lead-in, event, and tail-out pieces
    expect(pieces.length).toBeGreaterThanOrEqual(3);

    // Verify chronological order
    for (let i = 0; i < pieces.length - 1; i++) {
      const current = pieces[i];
      const next = pieces[i+1];
      expect(current.lte).toBeLessThanOrEqual(next.gte!);
    }

    // Verify extreme bounds are covered
    expect(pieces[0].gte).toBeLessThanOrEqual(-1e15);
    expect(pieces[pieces.length - 1].lte).toBeGreaterThanOrEqual(1e15);
  });

  it("highlights EVERY peak above 10 mmol/L using value-based scanning", () => {
    const multiPeakCluster: GlycemicCluster = {
      ...mockCluster,
      events: [
        {
          id: "evt-1",
          type: "hyper",
          startTime: "2023-01-01T10:00:00Z",
          endTime: "2023-01-01T10:15:00Z", // Official event is short
          startMinuteOfDay: 600,
          durationMinutes: 15,
          readings: [
            { timestamp: "2023-01-01T10:00:00Z", value: 180 }, // Above 10
            { timestamp: "2023-01-01T10:15:00Z", value: 150 }, // In range
            { timestamp: "2023-01-01T10:30:00Z", value: 200 }, // Above 10 again (NOT in official event)
            { timestamp: "2023-01-01T10:45:00Z", value: 150 }, // In range
          ],
        },
      ],
    };

    render(<ClusterEventsChart cluster={multiPeakCluster} units="MMOL" />);
    
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const pieces = options.visualMap[0].pieces;

    // Find pieces with full opacity (not ending in '33')
    const solidPieces = pieces.filter(p => !p.color.endsWith("33"));

    // Should have at least 2 solid pieces (one for event window, one for second peak)
    // Actually, depending on merging, it might be 2 distinct segments.
    expect(solidPieces.length).toBeGreaterThanOrEqual(2);
  });

  it("handles days with NO behavioral events but with value-based excursions", () => {
    // This scenario occurs if the backend missed an event but the frontend value scan caught it
    const clusterWithExcursionOnly: GlycemicCluster = {
      ...mockCluster,
      events: [
        {
          ...mockCluster.events[0],
          startTime: "2023-01-01T10:00:00Z",
          endTime: "2023-01-01T10:05:00Z",
          readings: [
            { timestamp: "2023-01-01T10:00:00Z", value: 100 }, // In range
            { timestamp: "2023-01-01T10:30:00Z", value: 250 }, // Massive peak outside event
            { timestamp: "2023-01-01T11:00:00Z", value: 100 }, // In range
          ],
        },
      ],
    };

    render(<ClusterEventsChart cluster={clusterWithExcursionOnly} units="MGDL" />);
    
    const options = mockReactECharts.mock.calls[0][0].option as MockOption;
    const solidPieces = options.visualMap[0].pieces.filter(p => !p.color.endsWith("33"));

    expect(solidPieces.length).toBeGreaterThan(0);
    // The peak at 10:30 should be captured
  });
});
