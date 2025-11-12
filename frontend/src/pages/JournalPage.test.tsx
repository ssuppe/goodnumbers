// file: frontend/src/pages/JournalPage.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import JournalPage from "./JournalPage";
import { api } from "../lib/api";
import { mockJournalForView } from "../mocks/journal";

// Mock the API and all child components
vi.mock("../lib/api");
vi.mock("../components/journal/PodcastPlayer", () => ({
  default: () => <div data-testid="podcast-player" />,
}));
vi.mock("../components/journal/AGPChart", () => ({
  default: () => <div data-testid="agp-chart" />,
}));
vi.mock("../components/journal/InsightsList", () => ({
  default: () => <div data-testid="insights-list" />,
}));
vi.mock("../components/journal/WeeklyVibe", () => ({
  default: () => <div data-testid="weekly-vibe" />,
}));
vi.mock("../components/journal/InfluencingFactors", () => ({
  default: () => <div data-testid="influencing-factors" />,
}));
vi.mock("../components/journal/EventClusterCard", () => ({
  default: ({ cluster }) => <div data-testid={`cluster-card-${cluster.id}`} />,
}));
vi.mock("../components/journal/Goals", () => ({
  default: () => <div data-testid="goals" />,
}));

const renderComponent = (journalId: string) => {
  render(
    <MemoryRouter initialEntries={[`/journal/${journalId}`]}>
      <Routes>
        <Route path="/journal/:id" element={<JournalPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("JournalPage", () => {
  it("shows a loading state while fetching data", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    renderComponent("test-id");
    expect(screen.getByText(/Loading your journal.../i)).toBeInTheDocument();
  });

  it("shows an error message if the API call fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Failed to fetch"));
    renderComponent("test-id");
    await waitFor(() => {
      expect(screen.getByText(/Failed to load journal/i)).toBeInTheDocument();
    });
  });

  it("fetches data and renders all child components on success", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    renderComponent(mockJournalForView.id);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        `/journals/${mockJournalForView.id}`,
      );
      // Verify all components are rendered
      expect(screen.getByTestId("podcast-player")).toBeInTheDocument();
      expect(screen.getByTestId("weekly-vibe")).toBeInTheDocument();
      expect(screen.getByTestId("influencing-factors")).toBeInTheDocument();
      expect(screen.getByTestId("cluster-card-cluster-1")).toBeInTheDocument(); // Check for cluster cards
      expect(screen.getByTestId("agp-chart")).toBeInTheDocument();
      expect(screen.getByTestId("insights-list")).toBeInTheDocument();

      expect(screen.getByTestId("goals")).toBeInTheDocument();
    });
  });
});
