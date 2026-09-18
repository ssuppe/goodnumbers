import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuickCoachPage from "../QuickCoachPage";
import { api } from "../../lib/api";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { preferredUnits: "MGDL" },
  }),
}));

vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
  updateJournal: vi.fn(),
}));

describe("QuickCoachPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockJournal = {
    id: "journal-123",
    startDate: "2026-09-08T00:00:00.000Z",
    endDate: "2026-09-14T23:59:59.000Z",
    weeklyVibe: "Tired",
    goalsForNextWeek: null,
    clusters: [
      {
        id: "cluster-1",
        eventType: "hyper",
        eventCount: 4,
        meanTimeMinutes: 13 * 60 + 30, // 1:30 PM
        isPrimaryFocus: true,
        clusterDataJson: {
          id: "cluster-1",
          type: "hyper",
          avgStartMinute: 810,
          events: [],
        },
        aiInsight: {
          observation: "Post-lunch highs observed regularly.",
          quickCoachStory: {
            audio_script: "Let us review your post-lunch highs.",
            animation_cues: [
              { time_ms: 0, action: "DRAW_MEAN", label: "Average Trend" },
            ],
          },
        },
      },
      {
        id: "cluster-2",
        eventType: "hypo",
        eventCount: 1,
        meanTimeMinutes: 3 * 60,
        isPrimaryFocus: false,
        clusterDataJson: {},
      },
    ],
  };

  it("renders loading spinner initially and fetches journal by id", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockJournal });

    render(
      <MemoryRouter initialEntries={["/coach/journal-123"]}>
        <Routes>
          <Route path="/coach/:journalId" element={<QuickCoachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/journals/journal-123");
    });
  });

  it("renders quick coach header, date badge, and primary focus cluster", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockJournal });

    render(
      <MemoryRouter initialEntries={["/coach/journal-123"]}>
        <Routes>
          <Route path="/coach/:journalId" element={<QuickCoachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Quick Coach/i)).toBeInTheDocument();
    });

    // Verify primary cluster is selected
    expect(screen.getByText(/High Blood Sugar Pattern/i)).toBeInTheDocument();
    expect(screen.getByText(/13:30/i)).toBeInTheDocument();
  });

  it("renders error message if journal fetch fails", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Journal not found"));

    render(
      <MemoryRouter initialEntries={["/coach/non-existent"]}>
        <Routes>
          <Route path="/coach/:journalId" element={<QuickCoachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load coaching session/i),
      ).toBeInTheDocument();
    });
  });

  it("renders celebration empty state when no clusters exist in the weekly journal", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        ...mockJournal,
        clusters: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/coach/journal-123"]}>
        <Routes>
          <Route path="/coach/:journalId" element={<QuickCoachPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No Recurring Patterns Detected!/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Your numbers were steady this week/i),
      ).toBeInTheDocument();
    });
  });
});
