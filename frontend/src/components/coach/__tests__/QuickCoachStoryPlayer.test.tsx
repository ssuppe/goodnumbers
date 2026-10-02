import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import QuickCoachStoryPlayer from "../QuickCoachStoryPlayer";
import { GlycemicEventCluster } from "@goodnumbers/types";

// Mock echarts-for-react
let capturedOption: Record<string, unknown> | null = null;
vi.mock("echarts-for-react", () => ({
  default: ({ option }: { option: Record<string, unknown> }) => {
    capturedOption = option;
    return <div data-testid="mock-echarts" />;
  },
}));

describe("QuickCoachStoryPlayer", () => {
  const mockCluster: GlycemicEventCluster = {
    id: "cluster-lunch",
    journalId: "journal-123",
    eventType: "hyper",
    eventCount: 3,
    meanTimeMinutes: 13 * 60 + 30, // 1:30 PM
    isPrimaryFocus: true,
    clusterDataJson: {
      id: "cluster-lunch",
      type: "hyper",
      avgStartMinute: 810,
      events: [
        {
          id: "ev-1",
          type: "hyper",
          startTime: "2026-09-14T13:30:00Z",
          endTime: "2026-09-14T15:30:00Z",
          startMinuteOfDay: 810,
          durationMinutes: 120,
          readings: [
            { timestamp: "2026-09-14T13:30:00Z", value: 160 },
            { timestamp: "2026-09-14T14:30:00Z", value: 240 },
          ],
        },
      ],
    },
    aiInsight: {
      observation: "Consistent post-lunch spikes.",
      quickCoachStory: {
        audio_script: "Let us review your post-lunch data.",
        animation_cues: [
          { time_ms: 0, action: "DRAW_MEAN", label: "Average Trend" },
          {
            time_ms: 2000,
            action: "DRAW_DAY",
            day_index: 0,
            label: "Monday Trace",
          },
          {
            time_ms: 4000,
            action: "DRAW_TREATMENTS",
            day_index: 0,
            label: "Bolus",
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    capturedOption = null;

    // Mock SpeechSynthesis
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
      speaking: false,
      paused: false,
      pending: false,
      onvoiceschanged: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders story controls, chart container, and initial state", () => {
    render(<QuickCoachStoryPlayer cluster={mockCluster} />);

    expect(screen.getByTestId("quick-coach-story-player")).toBeInTheDocument();
    expect(screen.getByTestId("echarts-story-container")).toBeInTheDocument();
    expect(screen.getByTestId("mock-echarts")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Play Story|Play Data Story/i }),
    ).toBeInTheDocument();
  });

  it("plays narration and triggers animation cues synchronized with speech completion", () => {
    const onEnd = vi.fn();
    render(<QuickCoachStoryPlayer cluster={mockCluster} onStoryEnd={onEnd} />);

    const playBtn = screen.getByRole("button", {
      name: /Play Story|Play Data Story/i,
    });
    fireEvent.click(playBtn);

    // Initial state at t=0 has DRAW_MEAN
    expect(capturedOption).toBeDefined();

    // Fast-forward speech duration (e.g. 8000ms for full sentence narration)
    act(() => {
      vi.advanceTimersByTime(8500);
    });

    expect(screen.getByText(/Monday: Trace/i)).toBeInTheDocument();

    // Fast-forward remaining steps to trigger onStoryEnd
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(onEnd).toHaveBeenCalled();
  });

  it("handles multistep day-by-day progression with glucose, carbs, and insulin charts", () => {
    const multiDayCluster: GlycemicEventCluster = {
      id: "cluster-twoday",
      journalId: "journal-twoday",
      eventType: "hyper",
      eventCount: 2,
      meanTimeMinutes: 14 * 60, // 2:00 PM
      isPrimaryFocus: true,
      clusterDataJson: {
        id: "cluster-twoday",
        type: "hyper",
        avgStartMinute: 840,
        events: [
          {
            id: "ev-tue",
            type: "hyper",
            startTime: "2026-09-15T13:30:00Z", // Tuesday
            endTime: "2026-09-15T15:30:00Z",
            startMinuteOfDay: 810,
            durationMinutes: 120,
            readings: [
              { timestamp: "2026-09-15T13:30:00Z", value: 140 },
              { timestamp: "2026-09-15T14:00:00Z", value: 190 },
              { timestamp: "2026-09-15T14:30:00Z", value: 230 },
              { timestamp: "2026-09-15T15:00:00Z", value: 210 },
              { timestamp: "2026-09-15T15:30:00Z", value: 160 },
            ],
          },
          {
            id: "ev-wed",
            type: "hyper",
            startTime: "2026-09-16T13:45:00Z", // Wednesday
            endTime: "2026-09-16T15:45:00Z",
            startMinuteOfDay: 825,
            durationMinutes: 120,
            readings: [
              { timestamp: "2026-09-16T13:45:00Z", value: 135 },
              { timestamp: "2026-09-16T14:15:00Z", value: 185 },
              { timestamp: "2026-09-16T14:45:00Z", value: 220 },
              { timestamp: "2026-09-16T15:15:00Z", value: 200 },
              { timestamp: "2026-09-16T15:45:00Z", value: 155 },
            ],
          },
        ],
      },
      aiInsight: {
        observation: "Afternoon post-lunch spikes on Tuesday and Wednesday.",
      },
    };

    const mockTreatments = [
      {
        id: "t-tue-carb",
        date: new Date("2026-09-15T13:15:00Z").getTime(),
        carbs: 45,
        insulin: 0,
      },
      {
        id: "t-tue-ins",
        date: new Date("2026-09-15T13:20:00Z").getTime(),
        carbs: 0,
        insulin: 3.5,
      },
      {
        id: "t-wed-carb",
        date: new Date("2026-09-16T13:30:00Z").getTime(),
        carbs: 50,
        insulin: 0,
      },
      {
        id: "t-wed-ins",
        date: new Date("2026-09-16T13:35:00Z").getTime(),
        carbs: 0,
        insulin: 4.0,
      },
    ];

    render(
      <QuickCoachStoryPlayer
        cluster={multiDayCluster}
        treatments={mockTreatments}
        units="MGDL"
      />,
    );

    // Initial / Step 1: Shows Mean trendline, blood glucose only
    expect(screen.getByText(/Average Trend/i)).toBeInTheDocument();
    expect(capturedOption).toBeDefined();

    const initialSeries = capturedOption?.series as Array<{
      name?: string;
      type?: string;
    }>;
    expect(initialSeries.some((s) => s.name === "Average Trend")).toBe(true);
    // At Step 1, day lines, carbs bars, and insulin bars are NOT yet present
    expect(initialSeries.filter((s) => s.type === "bar").length).toBe(0);

    // Advance to Step 2 (First Day - Tuesday)
    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Tuesday: Trace/i)).toBeInTheDocument();
    const step2Series = capturedOption?.series as Array<{
      name?: string;
      type?: string;
    }>;
    // Tuesday line is added
    expect(step2Series.some((s) => s.name?.includes("Tuesday"))).toBe(true);
    // Tuesday Carbs and Insulin bars are animated in
    const step2Bars = step2Series.filter((s) => s.type === "bar");
    expect(step2Bars.length).toBeGreaterThanOrEqual(1);

    // Advance to Step 3 (Second Day - Wednesday)
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Wednesday: Trace/i)).toBeInTheDocument();
    const step3Series = capturedOption?.series as Array<{
      name?: string;
      type?: string;
    }>;
    // Both Tuesday and Wednesday are present
    expect(step3Series.some((s) => s.name?.includes("Tuesday"))).toBe(true);
    expect(step3Series.some((s) => s.name?.includes("Wednesday"))).toBe(true);
    expect(step3Series.filter((s) => s.type === "bar").length).toBeGreaterThan(
      step2Bars.length,
    );
  });

  it("properly configures Y-axis scale and unit label for MMOL mode", () => {
    const mmolCluster: GlycemicEventCluster = {
      id: "cluster-mmol",
      journalId: "journal-mmol",
      eventType: "hyper",
      eventCount: 1,
      meanTimeMinutes: 12 * 60,
      isPrimaryFocus: true,
      clusterDataJson: {
        id: "cluster-mmol",
        type: "hyper",
        avgStartMinute: 720,
        events: [
          {
            id: "ev-1",
            type: "hyper",
            startTime: "2026-09-14T12:00:00Z",
            endTime: "2026-09-14T14:00:00Z",
            startMinuteOfDay: 720,
            durationMinutes: 120,
            readings: [
              { timestamp: "2026-09-14T12:00:00Z", value: 144 },
              { timestamp: "2026-09-14T13:00:00Z", value: 216 },
            ],
          },
        ],
      },
      aiInsight: null,
    };

    render(<QuickCoachStoryPlayer cluster={mmolCluster} units="MMOL" />);

    const yAxes = capturedOption?.yAxis as Array<{
      name?: string;
      min?: (v: { min: number }) => number;
      max?: (v: { max: number }) => number;
    }>;
    expect(yAxes[0].name).toContain("mmol/L");
    // When min is 8.0 mmol/L, axis min must not be blown out to 40
    const calculatedMin = yAxes[0].min!({ min: 8.0 });
    expect(calculatedMin).toBeLessThan(8.0);
    expect(calculatedMin).toBeGreaterThanOrEqual(0);
  });

  it("supports jumping directly via step pills, stepping backwards, and restarting", () => {
    render(<QuickCoachStoryPlayer cluster={mockCluster} />);

    // Jump to Wrap-up via step pill
    const wrapUpPill = screen.getByRole("button", { name: /Wrap-up/i });
    fireEvent.click(wrapUpPill);

    expect(screen.getAllByText(/Ready for Reflection/i).length).toBeGreaterThan(
      0,
    );

    // Step backwards via Prev button
    const prevBtn = screen.getByRole("button", { name: "Previous Step" });
    fireEvent.click(prevBtn);

    expect(screen.getByText(/Monday: Trace/i)).toBeInTheDocument();

    // Restart via Restart button
    const restartBtn = screen.getByRole("button", { name: "Restart" });
    fireEvent.click(restartBtn);

    expect(screen.getByText(/Average Trend/i)).toBeInTheDocument();
  });

  it("allows toggling pause and resume during playback", () => {
    render(<QuickCoachStoryPlayer cluster={mockCluster} />);

    const playBtn = screen.getByRole("button", {
      name: /Play Story|Play Data Story/i,
    });

    // Start playing
    fireEvent.click(playBtn);
    expect(
      screen.getByRole("button", { name: /Pause Story/i }),
    ).toBeInTheDocument();

    // Pause playback
    const pauseBtn = screen.getByRole("button", { name: /Pause Story/i });
    fireEvent.click(pauseBtn);
    expect(
      screen.getByRole("button", { name: /Play Story/i }),
    ).toBeInTheDocument();
  });

  it("handles a hypo cluster with single-grid layout when no treatments are present", () => {
    const hypoCluster: GlycemicEventCluster = {
      id: "cluster-hypo",
      journalId: "journal-hypo",
      eventType: "hypo",
      eventCount: 1,
      meanTimeMinutes: 3 * 60, // 3:00 AM
      isPrimaryFocus: true,
      clusterDataJson: {
        id: "cluster-hypo",
        type: "hypo",
        avgStartMinute: 180,
        events: [
          {
            id: "ev-hypo-1",
            type: "hypo",
            startTime: "2026-09-14T03:00:00Z",
            endTime: "2026-09-14T04:30:00Z",
            startMinuteOfDay: 180,
            durationMinutes: 90,
            readings: [
              { timestamp: "2026-09-14T03:00:00Z", value: 65 },
              { timestamp: "2026-09-14T03:45:00Z", value: 52 },
            ],
          },
        ],
      },
      aiInsight: null,
    };

    render(
      <QuickCoachStoryPlayer
        cluster={hypoCluster}
        treatments={[]}
        units="MGDL"
      />,
    );

    // Narration should refer to recurring lows
    expect(screen.getByText(/recurring lows pattern/i)).toBeInTheDocument();

    // Without treatments, grid has only 1 tier (height 80%)
    const grids = capturedOption?.grid as Array<{ height?: string }>;
    expect(grids.length).toBe(1);
    expect(grids[0].height).toBe("80%");
  });
});
