// file: frontend/src/hooks/useJournalStatus.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../lib/api";
import { useJournalStatus } from "./useJournalStatus";

vi.mock("../lib/api");

describe("useJournalStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should start with a PENDING status and poll the API", async () => {
    const mockApiGet = vi.mocked(api.get).mockResolvedValue({
      data: {
        status: "ANALYZING_DATA",
        progress: 20,
        statusMessage: "Analyzing...",
      },
    });

    const { result } = renderHook(() => useJournalStatus("test-id"));

    expect(result.current.status).toBe("PENDING");
    expect(result.current.progress).toBe(0);

    // Advance time for the first poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    // Assert that the API was called and the state was updated
    expect(mockApiGet).toHaveBeenCalledWith("/journals/test-id/status");
    expect(result.current.status).toBe("ANALYZING_DATA");
    expect(result.current.progress).toBe(20);
  });

  it("should stop polling when status is COMPLETE", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: {
          status: "ANALYZING_DATA",
          progress: 20,
          statusMessage: "Analyzing...",
        },
      })
      .mockResolvedValueOnce({
        data: { status: "COMPLETE", progress: 100, statusMessage: "Done" },
      });

    const { result } = renderHook(() => useJournalStatus("test-id"));

    // First poll should update status to ANALYZING_DATA
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(result.current.status).toBe("ANALYZING_DATA");

    // Second poll should update status to COMPLETE
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(result.current.status).toBe("COMPLETE");

    // Verify that polling has stopped
    vi.mocked(api.get).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000); // Advance time well past the interval
    });

    expect(api.get).not.toHaveBeenCalled();
  });
});
