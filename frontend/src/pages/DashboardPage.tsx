import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
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

  const isJournalCreationAllowed = useMemo(() => {
    if (journals.length === 0) return true;
    const latestJournalDate = new Date(journals[0].createdAt);
    if (isNaN(latestJournalDate.getTime())) {
      console.error(
        "Invalid date found for latest journal:",
        journals[0].createdAt,
      );
      return false;
    }
    return differenceInDays(new Date(), latestJournalDate) >= 3;
  }, [journals]);

  const [handleStartJournal, isSubmitting, creationError] = useApiForm(
    async () => {
      const response = await api.post<{ journal: { id: string } }>("/journals");
      const newJournalId = response.data.journal.id;
      navigate(`/journal/${newJournalId}/loading`);
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-8">
        <Loader2 className="animate-spin w-8 h-8 text-[#1976d2]" />
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
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <StartJournalCard
        isEnabled={isJournalCreationAllowed}
        isSubmitting={isSubmitting}
        error={creationError}
        onClick={() => void handleStartJournal({})}
        latestJournalDate={
          journals.length > 0 ? new Date(journals[0].createdAt) : undefined
        }
      />
      <PastJournalsList journals={journals} />
    </div>
  );
}
