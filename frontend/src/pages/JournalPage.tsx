import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api, updateJournal } from "../lib/api";
import { type Journal, type GlycemicEventCluster } from "@goodnumbers/types";
import { Loader2, AlertTriangle } from "lucide-react";

import PodcastPlayer from "../components/journal/PodcastPlayer";
import AGPChart from "../components/journal/AGPChart";
import InsightsList from "../components/journal/InsightsList";
import WeeklyVibe from "../components/journal/WeeklyVibe";
import InfluencingFactors from "../components/journal/InfluencingFactors";
import EventClusterCard from "../components/journal/EventClusterCard";
import Goals from "../components/journal/Goals";

type JournalResponse = Journal & { clusters: GlycemicEventCluster[] };

interface JournalFormData {
  weeklyVibe: string | null;
  influencingFactors: string[];
}

export default function JournalPage() {
  const { id } = useParams<{ id: string }>();
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [formData, setFormData] = useState<JournalFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchJournal = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<JournalResponse>(`/journals/${id}`);
        setJournal(response.data);
        setFormData({
          weeklyVibe: response.data.weeklyVibe,
          influencingFactors:
            (response.data.influencingFactors as string[]) || [],
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        setError(
          "Failed to load journal. It might not exist or you may not have permission to view it.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    void fetchJournal();
  }, [id]);

  const handleSave = async () => {
    if (!id || !formData) return;
    setIsSaving(true);
    try {
      await updateJournal(id, formData);
      // Optionally refetch or show success toast
    } catch (err) {
      console.error("Failed to save journal", err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-8">
        <Loader2 className="animate-spin w-8 h-8 text-[#1976d2]" />
        <span className="ml-3 text-lg text-gray-700">
          Loading your journal...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-red-600 bg-red-100 rounded-xl m-4 text-center font-semibold flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 mr-3" /> {error}
      </div>
    );
  }

  if (!journal) {
    return null; // Or a "Not Found" component
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <PodcastPlayer
        title={journal.podcastTitle}
        description={journal.podcastDescription}
        audioUrl={journal.podcastAudioUrl}
      />
      {formData && (
        <WeeklyVibe
          selectedVibe={formData.weeklyVibe}
          onChange={(vibe) =>
            setFormData((prev) => ({ ...prev!, weeklyVibe: vibe }))
          }
        />
      )}
      {formData && (
        <InfluencingFactors
          selectedFactors={formData.influencingFactors}
          onChange={(factors) =>
            setFormData((prev) => ({ ...prev!, influencingFactors: factors }))
          }
        />
      )}
      {journal.clusters.map((cluster) => (
        <EventClusterCard key={cluster.id} cluster={cluster} />
      ))}
      <AGPChart data={journal.agpChartData} />
      <InsightsList data={journal.analysisInsights} />
      <Goals data={journal.goalsForNextWeek} />
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 flex justify-end shadow-lg z-50">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
      <div className="h-20" /> {/* Spacer for fixed footer */}
    </div>
  );
}
