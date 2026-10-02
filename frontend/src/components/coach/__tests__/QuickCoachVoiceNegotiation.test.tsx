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

  it("sends reflection message to chat API and receives AI response without auto-setting goal widget", async () => {
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
          chatHistory: expect.any(Array),
        }),
      );
    });

    // AI message should be visible in chat feed
    await waitFor(() => {
      expect(
        screen.getAllByText(/walk 15 minutes right after lunch/i).length,
      ).toBeGreaterThan(0);
    });

    // Proposed goal card should NOT appear automatically on simple chat message
    expect(
      screen.queryByRole("button", { name: /Set as Weekly Micro-Habit/i }),
    ).not.toBeInTheDocument();
    expect(onGoalAgreed).not.toHaveBeenCalled();
  });

  it("drafts micro-goal from conversation transcript on button click", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: {
          reply:
            "Walking for 10-15 minutes after lunch helps blunt post-meal spikes.",
        },
      })
      .mockResolvedValueOnce({
        data: {
          synthesizedInsight: "Take a 15-minute walk right after lunch on weekdays.",
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

    // Send a message first
    const input = screen.getByPlaceholderText(/10 minute walk after lunch/i);
    fireEvent.change(input, { target: { value: "I will try walking after lunch" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(screen.getByText(/blunt post-meal spikes/i)).toBeInTheDocument();
    });

    // Click 'Draft Micro-Goal from Conversation' button
    const draftBtn = screen.getByRole("button", {
      name: /Draft Micro-Goal/i,
    });
    fireEvent.click(draftBtn);

    // Should call save-insight endpoint with chat history
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/journals/journal-1/clusters/cluster-1/save-insight",
        expect.objectContaining({
          chatHistory: expect.any(Array),
        }),
      );
    });

    // Synthesized micro-goal card appears
    await waitFor(() => {
      expect(
        screen.getByText(/Take a 15-minute walk right after lunch/i),
      ).toBeInTheDocument();
    });

    // Click 'Set as Weekly Micro-Habit'
    const setGoalBtn = screen.getByRole("button", {
      name: /Set as Weekly Micro-Habit/i,
    });
    fireEvent.click(setGoalBtn);

    expect(onGoalAgreed).toHaveBeenCalledWith(
      "Take a 15-minute walk right after lunch on weekdays.",
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

  it("strips unit suffixes from speech synthesis utterances", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        reply: "Your blood sugar spiked to 9.5 mmol/L around 140 mg/dL.",
      },
    });

    render(
      <QuickCoachVoiceNegotiation
        journalId="journal-1"
        clusterId="cluster-1"
        isStoryFinished={true}
        onGoalAgreed={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/10 minute walk after lunch/i);
    fireEvent.change(input, { target: { value: "How high did it get?" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

    await waitFor(() => {
      expect(screen.getByText(/spiked to 9.5 mmol\/L/i)).toBeInTheDocument();
    });

    const replayVoiceBtn = screen.getByRole("button", {
      name: /Replay Voice/i,
    });
    fireEvent.click(replayVoiceBtn);

    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith(
      expect.not.stringMatching(/mmol\/L|mg\/dL/i),
    );
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
    expect(mockInstance.continuous).toBe(true);
    expect(mockInstance.interimResults).toBe(true);

    // Simulate transcript result
    mockInstance.onresult({
      results: [[{ transcript: "I will walk for 10 minutes" }]],
    });

    // Live transcript populates input box
    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        /10 minute walk after lunch/i,
      );
      expect(input.value).toBe("I will walk for 10 minutes");
    });

    // Send the transcribed message
    const sendBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/journals/journal-1/clusters/cluster-1/chat",
        expect.objectContaining({
          message: "I will walk for 10 minutes",
          chatHistory: expect.any(Array),
        }),
      );
    });

    // Simulate error and end callbacks
    mockInstance.onerror({ error: "network" });
    mockInstance.onend();
  });
});
