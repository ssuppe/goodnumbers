import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { api } from "../lib/api";
import { type JournalSummary } from "../types/dashboard";
import { addDays } from "date-fns";

// Mock the API module
vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the sub-components
vi.mock("../components/dashboard/StartJournalCard", () => ({
  default: vi.fn((props) => (
    <div data-testid="start-journal-card" {...props}>
      StartJournalCard Mock
      {/* Conditionally render button based on isProcessing */}
      {!props.isProcessing && (
        <button
          onClick={props.onClick}
          disabled={props.isSubmitting}
        >
          {props.isSubmitting ? "Starting..." : "Start Journal"}
        </button>
      )}
      {props.error && (
        <div data-testid="start-journal-error">{props.error}</div>
      )}
      {props.isProcessing && <div>Processing...</div>}
    </div>
  )),
}));

vi.mock("../components/dashboard/PastJournalsList", () => ({
  default: vi.fn((props) => (
    <div data-testid="past-journals-list" {...props}>
      PastJournalsList Mock
      {/* @ts-expect-error: Mocked component props */}
      <div>Length: {props.journals.length}</div>
      {/* @ts-expect-error: Mocked component props */}
      {props.journals.map((journal: JournalSummary) => (
        <div key={journal.id}>{journal.podcastTitle}</div>
      ))}
    </div>
  )),
}));

// Import the mocked components for assertion
import StartJournalCard from "../components/dashboard/StartJournalCard";
import PastJournalsList from "../components/dashboard/PastJournalsList";

// Mock useNavigate
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

  it("renders loading state initially", () => {
    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockReturnValueOnce(new Promise(() => {})); // Never resolve
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    // @ts-expect-error: expect is augmented by Vitest
    expect(screen.getByText(/Loading dashboard.../i)).toBeInTheDocument();
  });

  it("renders error message if fetching journals fails", async () => {
    const errorMessage = "Failed to load journals.";
    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      // @ts-expect-error: expect is augmented by Vitest
      expect(
        screen.getByText(/Failed to load past journals/i),
      ).toBeInTheDocument();
    });
  });

  it("renders StartJournalCard and PastJournalsList with correct props when data is fetched successfully", async () => {
    // @ts-expect-error: Type needs 'status' but mock doesn't have it yet, we add it
    const mockJournals: JournalSummary[] = [
      {
        id: "1",
        createdAt: addDays(new Date(), -4).toISOString(),
        podcastTitle: "Week 1",
        podcastDescription: "Desc 1",
        weeklyVibe: "Sprouting",
        status: "COMPLETE", // ADDED
      },
    ];
    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: mockJournals });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // @ts-expect-error: expect is augmented by Vitest
      expect(screen.getByTestId("start-journal-card")).toBeInTheDocument();
      // @ts-expect-error: expect is augmented by Vitest
      expect(screen.getByTestId("past-journals-list")).toBeInTheDocument();
      
      // Verify props passed to StartJournalCard
      // @ts-expect-error: Mocked component props access
      const startJournalCardProps = vi.mocked(StartJournalCard).mock.calls[0][0];
      // @ts-expect-error: expect is augmented by Vitest
      expect(startJournalCardProps.isProcessing).toBe(false);

      // Verify props passed to PastJournalsList
      // @ts-expect-error: Mocked component props access
      const pastJournalsListProps = vi.mocked(PastJournalsList).mock.calls[0][0];
      // @ts-expect-error: expect is augmented by Vitest
      expect(pastJournalsListProps.journals).toEqual(mockJournals);
    });
  });

  it("initiates journal creation and navigates on success", async () => {
    const newJournalId = "new-journal-123";
    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [] }); // No existing journals
    // @ts-expect-error: Mocked API call
    (api.post as vi.Mock).mockResolvedValueOnce({
      data: { journal: { id: newJournalId } },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // @ts-expect-error: expect is augmented by Vitest
      const startJournalButton = screen.getByRole("button", {
        name: /Start Journal/i,
      });
      fireEvent.click(startJournalButton);
    });

    await waitFor(() => {
      // @ts-expect-error: expect is augmented by Vitest
      expect(api.post).toHaveBeenCalledWith("/journals");
      // @ts-expect-error: expect is augmented by Vitest
      expect(mockNavigate).toHaveBeenCalledWith(
        `/journal/${newJournalId}/loading`,
      );
    });
  });

  it("passes processing state to card and filters pending from list", async () => {
    // @ts-expect-error: Type needs 'status'
    const pending: JournalSummary = {
      id: '1', 
      status: 'PENDING', 
      createdAt: new Date().toISOString(),
      podcastTitle: null,
      podcastDescription: null,
      weeklyVibe: null
    };
    // @ts-expect-error: Type needs 'status'
    const complete: JournalSummary = {
      id: '2', 
      status: 'COMPLETE', 
      createdAt: addDays(new Date(), -7).toISOString(),
      podcastTitle: "Done",
      podcastDescription: "Desc",
      weeklyVibe: "Flourishing"
    };

    // @ts-expect-error: Mocked API call
    (api.get as vi.Mock).mockResolvedValueOnce({ data: [pending, complete] });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Verify StartJournalCard receives isProcessing=true
      // @ts-expect-error: Mocked component props access
      const startCalls = vi.mocked(StartJournalCard).mock.calls;
      const startCardProps = startCalls[startCalls.length - 1][0];
      // @ts-expect-error: expect is augmented by Vitest
      expect(startCardProps.isProcessing).toBe(true);

      // Verify PastJournalsList receives ONLY the complete journal (length 1)
      // @ts-expect-error: Mocked component props access
      const listCalls = vi.mocked(PastJournalsList).mock.calls;
      const listProps = listCalls[listCalls.length - 1][0];
      // @ts-expect-error: expect is augmented by Vitest
      expect(listProps.journals).toHaveLength(1);
      // @ts-expect-error: expect is augmented by Vitest
      expect(listProps.journals[0].id).toBe(complete.id);
    });
  });
});
