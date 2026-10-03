import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { api } from "../lib/api";
import { type JournalSummary } from "../types/dashboard";

// Mock the API module
vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(), // Mock delete
  },
}));

// Mock window.confirm
global.confirm = vi.fn(() => true);

// Mock the sub-components
vi.mock("../components/dashboard/StartJournalCard", () => ({
  default: vi.fn(() => (
    <div data-testid="start-journal-card">StartJournalCard Mock</div>
  )),
}));

vi.mock("../components/dashboard/QuickCoachBannerCard", () => ({
  default: vi.fn(({ isProcessing }: { isProcessing: boolean }) => (
    <div data-testid="quick-coach-banner-card">
      QuickCoachBannerCard Mock (isProcessing: {String(isProcessing)})
    </div>
  )),
}));

// Update PastJournalsList mock to include delete button simulation
vi.mock("../components/dashboard/PastJournalsList", () => ({
  default: vi.fn((props) => (
    <div data-testid="past-journals-list">
      {props.journals.map((journal: JournalSummary) => (
        <div key={journal.id}>
          <span>{journal.podcastTitle}</span>
          <button
            aria-label="Delete journal"
            onClick={() => props.onDelete(journal.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a journal when confirmed", async () => {
    const journalToDelete: JournalSummary = {
      id: "1",
      createdAt: new Date().toISOString(),
      podcastTitle: "To Delete",
      podcastDescription: "Desc",
      weeklyVibe: "Sprouting",
      status: "COMPLETE",
    };

    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [journalToDelete] });
    // @ts-expect-error: Mocked API call
    (api.delete as vi.Mock).mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Wait for list to render
    await waitFor(() => {
      expect(screen.getByText("To Delete")).toBeInTheDocument();
    });

    // Click delete
    const deleteBtn = screen.getByRole("button", { name: /Delete journal/i });
    fireEvent.click(deleteBtn);

    // Assert API call
    await waitFor(() => {
      expect(global.confirm).toHaveBeenCalled();
      expect(api.delete).toHaveBeenCalledWith("/journals/1");
    });
  });

  it("renders QuickCoachBannerCard with isProcessing=false when no pending journals", async () => {
    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("quick-coach-banner-card")).toBeInTheDocument();
      expect(screen.getByText(/isProcessing: false/i)).toBeInTheDocument();
    });
  });

  it("renders QuickCoachBannerCard with isProcessing=true when a pending journal exists", async () => {
    const pendingJournal: JournalSummary = {
      id: "pending-1",
      createdAt: new Date().toISOString(),
      podcastTitle: "In Progress",
      podcastDescription: "Analyzing...",
      weeklyVibe: "Sprouting",
      status: "PENDING",
    };

    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [pendingJournal] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("quick-coach-banner-card")).toBeInTheDocument();
      expect(screen.getByText(/isProcessing: true/i)).toBeInTheDocument();
    });
  });

  it("renders QuickCoachBannerCard with isProcessing=true when an active processing journal (ANALYZING_DATA) exists", async () => {
    const processingJournal: JournalSummary = {
      id: "proc-1",
      createdAt: new Date().toISOString(),
      podcastTitle: "In Progress",
      podcastDescription: "Analyzing...",
      weeklyVibe: "Sprouting",
      status: "ANALYZING_DATA",
    };

    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [processingJournal] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("quick-coach-banner-card")).toBeInTheDocument();
      expect(screen.getByText(/isProcessing: true/i)).toBeInTheDocument();
    });
  });
});
