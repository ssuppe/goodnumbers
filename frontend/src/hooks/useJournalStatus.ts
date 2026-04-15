// file: frontend/src/hooks/useJournalStatus.ts
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { JournalStatus } from "@goodnumbers/types";

export function useJournalStatus(journalId: string | undefined) {
  const [status, setStatus] = useState<JournalStatus>({
    status: "PENDING",
    progress: 0,
    statusMessage: "Initializing...",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !journalId ||
      status.status === "COMPLETE" ||
      status.status === "FAILED"
    ) {
      return;
    }

    const poll = async () => {
      try {
        const response = await api.get<JournalStatus>(
          `/journals/${journalId}/status`,
        );
        setStatus(response.data);
      } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _error: unknown
      ) {
        setError("Failed to fetch journal status.");
        setStatus((prev) => ({ ...prev, status: "FAILED" }));
      }
    };

    // Fix 2: Call poll inside an anonymous function for setInterval
    const intervalId = setInterval(() => {
      void poll(); // Use 'void' to explicitly indicate that the promise is intentionally not awaited
    }, 2000);

    return () => clearInterval(intervalId);
  }, [journalId, status.status]);

  return { ...status, error };
}
