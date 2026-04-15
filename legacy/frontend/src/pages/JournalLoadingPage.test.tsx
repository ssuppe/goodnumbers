import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import JournalLoadingPage from "./JournalLoadingPage";
import * as useJournalStatusModule from "../hooks/useJournalStatus";

// Mock the hook
vi.mock("../hooks/useJournalStatus");
const mockedUseJournalStatus = vi.mocked(
  useJournalStatusModule.useJournalStatus,
);

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("JournalLoadingPage", () => {
  it("displays the progress and status message from the hook", () => {
    mockedUseJournalStatus.mockReturnValue({
      status: "ANALYZING_DATA",
      progress: 50,
      statusMessage: "Analyzing your data...",
      error: null,
    });

    render(
      <MemoryRouter>
        <JournalLoadingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Generating Your Journal...")).toBeInTheDocument();
    expect(screen.getByText("Analyzing your data...")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    // More robust test: check the ARIA value instead of the visual style.
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("navigates to the journal page when status is COMPLETE", async () => {
    mockedUseJournalStatus.mockReturnValue({
      status: "COMPLETE",
      progress: 100,
      statusMessage: "Your journal is ready.",
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/journal/test-id/loading"]}>
        <Routes>
          <Route
            path="/journal/:journalId/loading"
            element={<JournalLoadingPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/journal/test-id", {
        replace: true,
      });
    });
  });

  it("displays an error message when the hook reports an error", () => {
    mockedUseJournalStatus.mockReturnValue({
      status: "FAILED",
      progress: 0,
      statusMessage: "Something went wrong.",
      error: "API connection failed",
    });

    render(
      <MemoryRouter>
        <JournalLoadingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Generation Failed")).toBeInTheDocument();
    expect(screen.getByText("API connection failed")).toBeInTheDocument();
  });
});
