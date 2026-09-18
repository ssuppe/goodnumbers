import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QuickCoachVoiceNegotiation from "../QuickCoachVoiceNegotiation";
import { api } from "../../../lib/api";

vi.mock("../../../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("QuickCoachVoiceNegotiation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechSynthesisUtterance = vi
      .fn()
      .mockImplementation((text) => ({ text }));
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

  it("renders prompt question and input controls", () => {
    render(
      <QuickCoachVoiceNegotiation
        journalId="journal-1"
        clusterId="cluster-1"
        isStoryFinished={true}
        onGoalAgreed={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("quick-coach-voice-negotiation"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/10 minute walk after lunch/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Push to Talk/i }),
    ).toBeInTheDocument();
  });

  it("sends reflection message to chat API and receives AI response", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        reply:
          "Great idea. Let's aim to walk 15 minutes right after lunch on weekdays.",
      },
    });

    const onGoalAgreed = vi.fn();
    render(
      <QuickCoachVoiceNegotiation
        journalId="journal-1"
        clusterId="cluster-1"
        isStoryFinished={true}
        onGoalAgreed={onGoalAgreed}
      />,
    );

    const input = screen.getByPlaceholderText(/10 minute walk after lunch/i);
    fireEvent.change(input, {
      target: { value: "I want to walk after lunch" },
    });

    const sendBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/journals/journal-1/clusters/cluster-1/chat",
        expect.objectContaining({
          message: "I want to walk after lunch",
        }),
      );
    });

    // AI message should be visible
    await waitFor(() => {
      expect(
        screen.getAllByText(/walk 15 minutes right after lunch/i).length,
      ).toBeGreaterThan(0);
    });

    // Propose goal button should be available
    const setGoalBtn = screen.getByRole("button", {
      name: /Set as Weekly Micro-Habit/i,
    });
    fireEvent.click(setGoalBtn);

    expect(onGoalAgreed).toHaveBeenCalledWith(
      expect.stringContaining("walk 15 minutes right after lunch"),
    );
  });

  it("sends message via Enter key and handles API failure with clinical fallback", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network disconnect"));

    render(
      <QuickCoachVoiceNegotiation
        journalId="journal-1"
        clusterId="cluster-1"
        isStoryFinished={true}
        onGoalAgreed={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/10 minute walk after lunch/i);
    fireEvent.change(input, {
      target: { value: "Can I adjust my timing?" },
    });

    // Press Enter to submit
    fireEvent.keyDown(input, { key: "Enter" });

    // Fallback reply should appear in the feed
    await waitFor(() => {
      expect(
        screen.getAllByText(/adjusting meal bolus timing next week/i).length,
      ).toBeGreaterThan(0);
    });

    // Replay Voice button should be clickable
    const replayVoiceBtn = screen.getByRole("button", {
      name: /Replay Voice/i,
    });
    fireEvent.click(replayVoiceBtn);
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it("supports speech recognition push-to-talk lifecycle", async () => {
    type SpeechResultCallback =
      ((event: SpeechRecognitionEvent) => void) | null;
    type SpeechErrorCallback =
      ((event: SpeechRecognitionErrorEvent) => void) | null;
    type SpeechEndCallback = (() => void) | null;

    let mockInstance: MockSpeechRecognition | null = null;
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult: SpeechResultCallback = null;
      onerror: SpeechErrorCallback = null;
      onend: SpeechEndCallback = null;
      start = vi.fn();
      stop = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        mockInstance = this;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { reply: "Let's take a 10-minute post-meal stroll." },
    });

    render(
      <QuickCoachVoiceNegotiation
        journalId="journal-1"
        clusterId="cluster-1"
        isStoryFinished={true}
        onGoalAgreed={vi.fn()}
      />,
    );

    const micBtn = screen.getByRole("button", { name: /Push to Talk/i });

    // Start listening
    fireEvent.click(micBtn);
    expect(mockInstance.start).toHaveBeenCalled();

    // Simulate transcript result
    mockInstance.onresult({
      results: [[{ transcript: "I will walk for 10 minutes" }]],
    });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/journals/journal-1/clusters/cluster-1/chat",
        expect.objectContaining({
          message: "I will walk for 10 minutes",
        }),
      );
    });

    // Simulate error and end callbacks
    mockInstance.onerror({ error: "network" });
    mockInstance.onend();
  });
});
