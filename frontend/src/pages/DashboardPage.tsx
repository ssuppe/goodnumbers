import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useApiForm } from "../hooks/useApiForm";
import StartJournalCard from "../components/dashboard/StartJournalCard";
import PastJournalsList from "../components/dashboard/PastJournalsList";
import { type JournalSummary } from "../types/dashboard";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        const response = await api.get<JournalSummary[]>("/journals");
        setJournals(response.data);
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
        setFetchError(
          "Failed to load past journals. Please try refreshing the page.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void fetchJournals();
  }, []);

  // Identify if any journal is currently processing (PENDING status)
  const pendingJournal = useMemo(
    () => journals.find((j) => j.status === "PENDING"),
    [journals],
  );

  // Filter out pending journals from the history list to keep the UI clean
  const historyJournals = useMemo(
    () => journals.filter((j) => j.status !== "PENDING"),
    [journals],
  );

  const [handleStartJournal, isSubmitting, creationError] = useApiForm(
    async (data: { startDate?: string; endDate?: string }) => {
      const response = await api.post<{ journal: { id: string } }>(
        "/journals",
        data,
      );
      const newJournalId = response.data.journal.id;
      navigate(`/journal/${newJournalId}/loading`);
    },
  );

  const handleDeleteJournal = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this journal? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await api.delete(`/journals/${id}`);
      // Optimistically update the list
      setJournals((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      console.error("Failed to delete journal:", err);
      alert("Failed to delete journal. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-8">
        <Loader2 className="animate-spin w-8 h-8 text-mesa-primary" />
        <span className="ml-3 text-lg text-gray-700">Loading dashboard...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-red-600 bg-red-100 rounded-xl m-4 text-center font-semibold">
        {fetchError}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-4 lg:p-8">
      <StartJournalCard
        isProcessing={!!pendingJournal}
        isSubmitting={isSubmitting}
        error={creationError}
        onStart={(data) => {
          void handleStartJournal(data);
        }}
      />
      <PastJournalsList
        journals={historyJournals}
        onDelete={(id) => {
          void handleDeleteJournal(id);
        }}
      />
    </div>
  );
}
