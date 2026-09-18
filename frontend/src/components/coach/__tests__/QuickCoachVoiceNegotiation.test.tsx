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
});
