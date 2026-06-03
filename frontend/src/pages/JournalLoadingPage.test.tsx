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
  it("displays the progress, status message, and step indicators from the hook", () => {
    mockedUseJournalStatus.mockReturnValue({
      status: "ANALYZING_DATA",
      progress: 45,
      statusMessage: "Running non-AI, old-fashioned statistical analysis...",
      error: null,
    });

    render(
      <MemoryRouter>
        <JournalLoadingPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Generating Your Journal...")).toBeInTheDocument();
    expect(
      screen.getByText("Running non-AI, old-fashioned statistical analysis..."),
    ).toBeInTheDocument();

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "45");

    // Verify Step Indicators (DATA, STATS, AI)
    expect(screen.getByText("DATA")).toBeInTheDocument();
    expect(screen.getByText("STATS")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();

    // Verify Step 2 is active (bg-mesa-primary) and Step 1 is completed (green-500 or checkmark)
    // At 45%, Step 1 should be completed (✓), Step 2 should be active (2)
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("marks Step 3 as completed only when progress is 100", () => {
    mockedUseJournalStatus.mockReturnValue({
      status: "COMPLETE",
      progress: 100,
      statusMessage: "Your journal is ready.",
      error: null,
    });

    render(
      <MemoryRouter>
        <JournalLoadingPage />
      </MemoryRouter>,
    );

    // At 100%, all steps should be completed (✓)
    // We expect multiple checkmarks
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBe(3);
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
