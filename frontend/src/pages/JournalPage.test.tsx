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

// Mock the API
vi.mock("../lib/api");

// Mock child components

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
    onHelpReflect,
    isChatActive,
  }: {
    cluster: { id: string };
    userNote: string;
    onNoteChange: (n: string) => void;
    onHelpReflect?: () => void;
    isChatActive?: boolean;
  }) => (
    <div
      data-testid={`cluster-card-${cluster.id}`}
      className={isChatActive ? "active-chat" : ""}
    >
      <span data-testid={`cluster-note-${cluster.id}`}>{userNote}</span>
      <button onClick={() => onNoteChange("Updated Cluster Note")}>
        Update Note
      </button>
      {onHelpReflect && (
        <button
          onClick={onHelpReflect}
          data-testid={`help-reflect-${cluster.id}`}
        >
          Help me reflect
        </button>
      )}
    </div>
  ),
}));

vi.mock("../components/journal/ClusterChatInterface", () => ({
  default: ({
    clusterId,
    onSaveInsight,
    onClose,
  }: {
    clusterId: string;
    onSaveInsight: (note: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="mock-chat-drawer">
      <span data-testid="chat-cluster-id">{clusterId}</span>
      <button
        onClick={() => onSaveInsight("Synthesized Summary Note")}
        data-testid="chat-drawer-save"
      >
        Mock Summarize
      </button>
      <button onClick={onClose} data-testid="chat-drawer-close">
        Mock Close
      </button>
    </div>
  ),
}));

vi.mock("../components/journal/CollapsingNoteArea", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div data-testid="collapsing-note-area">
      <span data-testid="current-note">{value}</span>
      <button onClick={() => onChange("Updated Goals")}>Update Goals</button>
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
      expect(screen.getByTestId("weekly-vibe")).toBeInTheDocument();
      expect(screen.getByTestId("influencing-factors")).toBeInTheDocument();
      expect(screen.getByTestId("cluster-card-cluster-1")).toBeInTheDocument();
      expect(screen.getByTestId("chart-analysis-card")).toBeInTheDocument();
      expect(screen.getByTestId("collapsing-note-area")).toBeInTheDocument();
      expect(screen.getByTestId("sticky-action-bar")).toBeInTheDocument();
    });
  });

  it("updates local state and calls API on save with correct payload", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    renderComponent(mockJournalForView.id);

    await waitFor(() => {
      expect(screen.getByTestId("weekly-vibe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Select Growing"));
    expect(screen.getByTestId("current-vibe")).toHaveTextContent("Growing");

    fireEvent.click(screen.getByText("Update Goals"));
    expect(screen.getByTestId("current-note")).toHaveTextContent(
      "Updated Goals",
    );

    const clusterCard = screen.getByTestId("cluster-card-cluster-1");
    const updateNoteBtn = within(clusterCard).getByText("Update Note");
    fireEvent.click(updateNoteBtn);

    expect(screen.getByTestId("cluster-note-cluster-1")).toHaveTextContent(
      "Updated Cluster Note",
    );

    fireEvent.click(screen.getByText("Save Changes"));

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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderComponent(mockJournalForView.id);
    await waitFor(() => screen.getByTestId("sticky-action-bar"));

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteJournal).toHaveBeenCalledWith(mockJournalForView.id);
  });

  describe("AI Chat Drawer Integration", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
    });

    it("opens the chat drawer on help reflect click, highlights active card, and updates note on save", async () => {
      renderComponent(mockJournalForView.id);

      await waitFor(() => {
        expect(
          screen.getByTestId("cluster-card-cluster-1"),
        ).toBeInTheDocument();
      });

      // Confirm drawer is not visible initially
      expect(screen.queryByTestId("mock-chat-drawer")).not.toBeInTheDocument();

      // Click "Help me reflect" on Cluster 1
      fireEvent.click(screen.getByTestId("help-reflect-cluster-1"));

      // Drawer should be open, bound to cluster-1
      expect(screen.getByTestId("mock-chat-drawer")).toBeInTheDocument();
      expect(screen.getByTestId("chat-cluster-id")).toHaveTextContent(
        "cluster-1",
      );

      // Active card should have active highlight class
      const clusterCard1 = screen.getByTestId("cluster-card-cluster-1");
      expect(clusterCard1).toHaveClass("active-chat");

      // Click mock summarize inside the drawer
      fireEvent.click(screen.getByTestId("chat-drawer-save"));

      // Note text box on Cluster 1 card should be updated with synthesized summary
      expect(screen.getByTestId("cluster-note-cluster-1")).toHaveTextContent(
        "Synthesized Summary Note",
      );

      // Drawer should close
      expect(screen.queryByTestId("mock-chat-drawer")).not.toBeInTheDocument();
      expect(clusterCard1).not.toHaveClass("active-chat");
    });

    it("switches context and resets drawer when a new cluster help reflect button is clicked", async () => {
      renderComponent(mockJournalForView.id);

      await waitFor(() => {
        expect(
          screen.getByTestId("cluster-card-cluster-1"),
        ).toBeInTheDocument();
      });

      // Click "Help me reflect" on Cluster 1
      fireEvent.click(screen.getByTestId("help-reflect-cluster-1"));
      expect(screen.getByTestId("chat-cluster-id")).toHaveTextContent(
        "cluster-1",
      );

      const clusterCard1 = screen.getByTestId("cluster-card-cluster-1");
      expect(clusterCard1).toHaveClass("active-chat");

      // Click "Help me reflect" on Cluster 2 (mockJournalForView has multiple clusters, let's check its id, e.g. mockJournalForView.clusters[1].id is cluster-2 or similar)
      const secondClusterId = mockJournalForView.clusters[1]?.id || "cluster-2";
      await waitFor(() => {
        expect(
          screen.getByTestId(`cluster-card-${secondClusterId}`),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(`help-reflect-${secondClusterId}`));

      // Drawer context should switch to second cluster
      expect(screen.getByTestId("chat-cluster-id")).toHaveTextContent(
        secondClusterId,
      );

      // Highlight should move to second cluster
      expect(clusterCard1).not.toHaveClass("active-chat");
      expect(screen.getByTestId(`cluster-card-${secondClusterId}`)).toHaveClass(
        "active-chat",
      );
    });
  });
});
