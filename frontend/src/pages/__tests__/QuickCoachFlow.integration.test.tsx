import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuickCoachPage from "../QuickCoachPage";
import { api, updateJournal } from "../../lib/api";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { preferredUnits: "MGDL" },
  }),
}));

vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  updateJournal: vi.fn(),
}));

// Mock echarts-for-react
vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="echarts-mock">ECharts Canvas</div>,
}));

describe("QuickCoachFlow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockJournal = {
    id: "journal-test-456",
    startDate: "2026-09-08T00:00:00.000Z",
    endDate: "2026-09-14T23:59:59.000Z",
    weeklyVibe: "Exhausted",
    goalsForNextWeek: null,
    clusters: [
      {
        id: "cluster-lunch-spike",
        eventType: "hyper",
        eventCount: 5,
        meanTimeMinutes: 13 * 60,
        isPrimaryFocus: true,
        clusterDataJson: {
          id: "cluster-lunch-spike",
          type: "hyper",
          avgStartMinute: 780,
          events: [],
        },
        aiInsight: {
          observation: "Post-lunch spikes on 5 out of 7 days.",
          quickCoachStory: {
            audio_script:
              "Notice the sharp peak around 1 PM each day after lunch.",
            animation_cues: [
              { time_ms: 0, action: "DRAW_MEAN", label: "Average Curve" },
            ],
          },
        },
      },
    ],
  };

  it("completes the full flow: loads session, allows goal entry/proposal, saves to journal, and shows celebration", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockJournal });
    vi.mocked(updateJournal).mockResolvedValueOnce({
      ...mockJournal,
      goalsForNextWeek: "Pre-bolus 15 minutes before lunch",
    });

    render(
      <MemoryRouter initialEntries={["/coach/journal-test-456"]}>
        <Routes>
          <Route path="/coach/:journalId" element={<QuickCoachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // 1. Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Quick Coach/i)).toBeInTheDocument();
      expect(screen.getByText(/High Blood Sugar Pattern/i)).toBeInTheDocument();
    });

    // 2. Simulate user typing a habit in the negotiation text input
    const chatInput = screen.getByPlaceholderText(
      /10 minute walk after lunch/i,
    );
    fireEvent.change(chatInput, {
      target: { value: "Pre-bolus 15 minutes before lunch" },
    });

    // Mock chat response and synthesis response
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: {
          reply: "Pre-bolusing 15 minutes before lunch is a great approach.",
        },
      })
      .mockResolvedValueOnce({
        data: {
          synthesizedInsight: "Pre-bolus 15 minutes before lunch",
        },
      });

    const sendBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Pre-bolusing 15 minutes before lunch/i),
      ).toBeInTheDocument();
    });

    // Click "Draft Micro-Goal from Conversation"
    const draftBtn = screen.getByRole("button", {
      name: /Draft Micro-Goal/i,
    });
    fireEvent.click(draftBtn);

    // 3. Wait for the goal proposal card to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Drafted Weekly Micro-Habit/i),
      ).toBeInTheDocument();
    });

    // 4. Click "Set as Weekly Micro-Habit" button on the proposal card
    const lockInBtn = screen.getByRole("button", {
      name: /Set as Weekly Micro-Habit/i,
    });
    fireEvent.click(lockInBtn);

    // 5. The sticky bottom action bar appears with "Accept & Save"
    await waitFor(() => {
      expect(screen.getByText(/Agreed Micro-Habit/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Accept & Save/i }),
      ).toBeInTheDocument();
    });

    // 6. Click "Accept & Save"
    const acceptBtn = screen.getByRole("button", { name: /Accept & Save/i });
    fireEvent.click(acceptBtn);

    // 7. Verify updateJournal was called with correct journal ID and habit
    await waitFor(() => {
      expect(updateJournal).toHaveBeenCalledWith("journal-test-456", {
        goalsForNextWeek: "Pre-bolus 15 minutes before lunch",
      });
    });

    // 8. Verify celebration modal is displayed
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Micro-Habit Locked In!/i }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/"Pre-bolus 15 minutes before lunch"/i).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByRole("link", { name: /View Full Journal/i }),
      ).toHaveAttribute("href", "/journal/journal-test-456");
      expect(
        screen.getByRole("link", { name: /Close & Return to Dashboard/i }),
      ).toHaveAttribute("href", "/dashboard");
    });
  });
});
