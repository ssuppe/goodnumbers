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

  it("plays narration and triggers animation cues over time", () => {
    const onEnd = vi.fn();
    render(<QuickCoachStoryPlayer cluster={mockCluster} onStoryEnd={onEnd} />);

    const playBtn = screen.getByRole("button", {
      name: /Play Story|Play Data Story/i,
    });
    fireEvent.click(playBtn);

    // Initial state at t=0 has DRAW_MEAN
    expect(capturedOption).toBeDefined();

    // Fast-forward 2500ms to trigger cue 2 (DRAW_DAY: Monday Trace)
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.getByText(/Monday Trace/i)).toBeInTheDocument();

    // Fast-forward past totalDurationMs (8000ms) to trigger onStoryEnd
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onEnd).toHaveBeenCalled();
  });
});
