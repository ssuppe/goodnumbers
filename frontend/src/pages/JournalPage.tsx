import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
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

export default function JournalPage() {
  const { id } = useParams<{ id: string }>();
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchJournal = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<JournalResponse>(`/journals/${id}`);
        setJournal(response.data);
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
      <WeeklyVibe data={journal.weeklyVibe} />
      <InfluencingFactors data={journal.influencingFactors} />
      {journal.clusters.map((cluster) => (
        <EventClusterCard key={cluster.id} cluster={cluster} />
      ))}
      <AGPChart data={journal.agpChartData} />
      <InsightsList data={journal.analysisInsights} />
      <Goals data={journal.goalsForNextWeek} />
    </div>
  );
}
