import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import QuickCoachBannerCard from "./QuickCoachBannerCard";
import { api } from "../../lib/api";

// Mock the API module
vi.mock("../../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("QuickCoachBannerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders idle state with headline, copy, and action button", () => {
    render(
      <MemoryRouter>
        <QuickCoachBannerCard isProcessing={false} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Quick Coach: 3-Minute Glycemic Debrief/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Quick Coach/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Quick Coach/i }),
    ).not.toBeDisabled();
  });

  it("disables the button when a session is already in progress", () => {
    render(
      <MemoryRouter>
        <QuickCoachBannerCard isProcessing={true} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Session in progress/i });
    expect(button).toBeDisabled();
  });

  it("triggers API call on click and navigates to loading page with target=coach", async () => {
    // @ts-expect-error: Mocked API response
    (api.post as vi.Mock).mockResolvedValueOnce({
      data: { journalId: "test-coach-journal-123", status: "PENDING" },
    });

    render(
      <MemoryRouter>
        <QuickCoachBannerCard isProcessing={false} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Start Quick Coach/i });
    fireEvent.click(button);

    expect(api.post).toHaveBeenCalledWith("/coach/sessions");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/journal/test-coach-journal-123/loading?target=coach",
      );
    });
  });

  it("shows an actionable link to /setup when Nightscout credentials are missing", async () => {
    // @ts-expect-error: Mocked API error
    (api.post as vi.Mock).mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error:
            "Nightscout credentials required to start a coaching session. Please configure them in Settings.",
          code: "NIGHTSCOUT_REQUIRED",
        },
      },
    });

    render(
      <MemoryRouter>
        <QuickCoachBannerCard isProcessing={false} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Start Quick Coach/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/Nightscout credentials required/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Configure Nightscout in Settings/i }),
      ).toHaveAttribute("href", "/setup");
    });
  });

  it("displays generic error message when request fails", async () => {
    // @ts-expect-error: Mocked API error
    (api.post as vi.Mock).mockRejectedValueOnce(new Error("Network Error"));

    render(
      <MemoryRouter>
        <QuickCoachBannerCard isProcessing={false} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Start Quick Coach/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to start coaching session/i),
      ).toBeInTheDocument();
    });
  });
});
