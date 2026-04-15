import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateJournal, deleteJournal, api } from "./api";

// Mock the axios instance methods
vi.spyOn(api, "put").mockResolvedValue({ data: {} });
vi.spyOn(api, "delete").mockResolvedValue({ data: {} });

describe("Journal API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateJournal sends a PUT request with the correct payload", async () => {
    const journalId = "test-id";
    const payload = { weeklyVibe: "Sprouting" };

    await updateJournal(journalId, payload);

    expect(api.put).toHaveBeenCalledWith(`/journals/${journalId}`, payload);
  });

  it("deleteJournal sends a DELETE request", async () => {
    const journalId = "test-id";

    await deleteJournal(journalId);

    expect(api.delete).toHaveBeenCalledWith(`/journals/${journalId}`);
  });
});
