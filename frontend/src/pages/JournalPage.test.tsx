import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import JournalPage from "./JournalPage";
import { api, updateJournal, deleteJournal } from "../lib/api";
import { mockJournalForView } from "../mocks/journal";

// Mock the AuthContext
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { preferredUnits: "MGDL" },
  }),
}));

// Mock the API and all child components
vi.mock("../lib/api");

// Mock child components
vi.mock("../components/journal/PodcastPlayer", () => ({
  default: () => <div data-testid="podcast-player" />,
}));

vi.mock("../components/journal/ChartAnalysisCard", () => ({
  ChartAnalysisCard: () => <div data-testid="chart-analysis-card" />,
}));

vi.mock("../components/journal/WeeklyVibe", () => ({
  default: ({
    selectedVibe,
    onChange,
  }: {
    selectedVibe: string;
    onChange: (v: string) => void;
  }) => (
    <div data-testid="weekly-vibe">
      <span data-testid="current-vibe">{selectedVibe}</span>
      <button onClick={() => onChange("Growing")}>Select Growing</button>
    </div>
  ),
}));

vi.mock("../components/journal/InfluencingFactors", () => ({
  default: () => <div data-testid="influencing-factors" />,
}));

vi.mock("../components/journal/EventClusterCard", () => ({
  default: ({
    cluster,
    userNote,
    onNoteChange,
  }: {
    cluster: { id: string };
    userNote: string;
    onNoteChange: (n: string) => void;
  }) => (
    <div data-testid={`cluster-card-${cluster.id}`}>
      <span data-testid={`cluster-note-${cluster.id}`}>{userNote}</span>
      <button onClick={() => onNoteChange("Updated Cluster Note")}>
        Update Note
      </button>
    </div>
  ),
}));

vi.mock("../components/journal/ContextualNotesArea", () => ({
  default: ({
    notes,
    setNotes,
  }: {
    notes: string;
    setNotes: (n: string) => void;
  }) => (
    <div data-testid="contextual-notes">
      <span data-testid="current-goals">{notes}</span>
      <button onClick={() => setNotes("Updated Goals")}>Update Goals</button>
    </div>
  ),
}));

vi.mock("../components/journal/StickyActionBar", () => ({
  default: ({
    onSave,
    isLoading,
    error,
  }: {
    onSave: () => void;
    isLoading: boolean;
    error?: string | null;
  }) => (
    <div data-testid="sticky-action-bar">
      {isLoading && <span>Saving...</span>}
      {error && <span>{error}</span>}
      <button onClick={onSave}>Save Changes</button>
    </div>
  ),
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
      expect(screen.getByTestId("cluster-card-cluster-1")).toBeInTheDocument();
      // Updated assertion for the new Unified Card
      expect(screen.getByTestId("chart-analysis-card")).toBeInTheDocument();
      expect(screen.getByTestId("contextual-notes")).toBeInTheDocument();
      expect(screen.getByTestId("sticky-action-bar")).toBeInTheDocument();
    });
  });

  it("updates local state and calls API on save with correct payload", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    renderComponent(mockJournalForView.id);

    await waitFor(() => {
      expect(screen.getByTestId("weekly-vibe")).toBeInTheDocument();
    });

    // 1. Change the vibe
    fireEvent.click(screen.getByText("Select Growing"));
    expect(screen.getByTestId("current-vibe")).toHaveTextContent("Growing");

    // 2. Change Goals (ContextualNotesArea)
    fireEvent.click(screen.getByText("Update Goals"));
    expect(screen.getByTestId("current-goals")).toHaveTextContent(
      "Updated Goals",
    );

    // 3. Change Cluster Note
    const clusterCard = screen.getByTestId("cluster-card-cluster-1");
    const updateNoteBtn = within(clusterCard).getByText("Update Note");
    fireEvent.click(updateNoteBtn);

    expect(screen.getByTestId("cluster-note-cluster-1")).toHaveTextContent(
      "Updated Cluster Note",
    );

    // 4. Click Save
    fireEvent.click(screen.getByText("Save Changes"));

    // 5. Verify API call payload
    expect(updateJournal).toHaveBeenCalledWith(
      mockJournalForView.id,
      expect.objectContaining({
        weeklyVibe: "Growing",
        goalsForNextWeek: "Updated Goals",
        clusterNotes: expect.objectContaining({
          "cluster-1": "Updated Cluster Note",
        }),
      }),
    );
  });

  it("handles save errors correctly", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    vi.mocked(updateJournal).mockRejectedValue(new Error("Save failed"));

    renderComponent(mockJournalForView.id);
    await waitFor(() => screen.getByTestId("sticky-action-bar"));

    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("handles delete correctly", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderComponent(mockJournalForView.id);
    await waitFor(() => screen.getByTestId("sticky-action-bar"));

    // Find and click delete button (assuming it's rendered)
    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteJournal).toHaveBeenCalledWith(mockJournalForView.id);
  });
});