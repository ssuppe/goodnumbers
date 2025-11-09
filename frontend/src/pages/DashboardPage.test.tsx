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
      <button
        onClick={props.onClick}
        disabled={!props.isEnabled || props.isSubmitting}
      >
        {props.isSubmitting ? "Starting..." : "Start Journal"}
      </button>
      {props.error && (
        <div data-testid="start-journal-error">{props.error}</div>
      )}
    </div>
  )),
}));

vi.mock("../components/dashboard/PastJournalsList", () => ({
  default: vi.fn((props) => (
    <div data-testid="past-journals-list" {...props}>
      PastJournalsList Mock
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
    const mockJournals: JournalSummary[] = [
      {
        id: "1",
        createdAt: addDays(new Date(), -4).toISOString(),
        podcastTitle: "Week 1",
        podcastDescription: "Desc 1",
        weeklyVibe: "Sprouting",
      }, // Changed to 4 days ago
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
      const startJournalCardProps =
        vi.mocked(StartJournalCard).mock.calls[0][0];
      // @ts-expect-error: expect is augmented by Vitest
      expect(startJournalCardProps.isEnabled).toBe(true); // Assuming 3 days passed or no journals
      // @ts-expect-error: expect is augmented by Vitest
      expect(startJournalCardProps.latestJournalDate).toEqual(
        new Date(mockJournals[0].createdAt),
      );

      // Verify props passed to PastJournalsList
      // @ts-expect-error: Mocked component props access
      const pastJournalsListProps =
        vi.mocked(PastJournalsList).mock.calls[0][0];
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
});
