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
});
