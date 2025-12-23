import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, updateJournal, deleteJournal } from "../lib/api";
import { type Journal, type GlycemicEventCluster } from "@goodnumbers/types";
import { type ScoreCardData } from "@goodnumbers/schemas";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";

import PodcastPlayer from "../components/journal/PodcastPlayer";
import ScorecardRow from "../components/journal/ScorecardRow";
import {
  ChartAnalysisCard,
  type Insight,
} from "../components/journal/ChartAnalysisCard";
import { normalizeAgpData } from "../lib/agpUtils";
import { useAuth } from "../contexts/AuthContext";
import WeeklyVibe from "../components/journal/WeeklyVibe";
import InfluencingFactors from "../components/journal/InfluencingFactors";
import EventClusterCard from "../components/journal/EventClusterCard";
import ContextualNotesArea from "../components/journal/ContextualNotesArea";
import StickyActionBar from "../components/journal/StickyActionBar";

type JournalResponse = Journal & { clusters: GlycemicEventCluster[] };

interface JournalFormData {
  weeklyVibe: string | null;
  influencingFactors: string[];
  goalsForNextWeek: string;
  clusterNotes: Record<string, string>;
}

export default function JournalPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [formData, setFormData] = useState<JournalFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchJournal = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<JournalResponse>(`/journals/${id}`);
        setJournal(response.data);

        // Initialize form data
        setFormData({
          weeklyVibe: response.data.weeklyVibe,
          influencingFactors:
            (response.data.influencingFactors as string[]) || [],
          goalsForNextWeek: response.data.goalsForNextWeek || "",
          // Transform Array to Map for local editing state
          clusterNotes: response.data.clusters.reduce(
            (acc, cluster) => ({
              ...acc,
              [cluster.id]: cluster.userNotes || "",
            }),
            {} as Record<string, string>,
          ),
        });
      } catch {
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
    setSaveError(null);
    try {
      await updateJournal(id, formData);
      navigate("/dashboard");
    } catch {
      console.error("Failed to save journal: "); // Do NOT log the payload/err object to avoid PHI leak
      setSaveError("Failed to save. Please try again.");
      // Do NOT navigate away, let user retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    // In a real app, show a confirmation modal here
    navigate("/dashboard");
  };

  const handleDelete = async () => {
    if (!id) return;
    if (
      window.confirm(
        "Are you sure you want to permanently delete this journal entry?",
      )
    ) {
      try {
        await deleteJournal(id);
        navigate("/dashboard");
      } catch (error) {
        console.error("Failed to delete journal:", error);
        setError("Failed to delete journal.");
      }
    }
  };

  const normalizedAgpData = useMemo(
    () =>
      journal?.agpChartData
        ? normalizeAgpData(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            journal.agpChartData as any[],
            user?.preferredUnits || "MGDL",
          )
        : [],
    [journal?.agpChartData, user?.preferredUnits],
  );

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

  if (!journal || !formData) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 pb-24">
      <PodcastPlayer
        title={journal.podcastTitle}
        description={journal.podcastDescription}
        audioUrl={journal.podcastAudioUrl}
      />

      <WeeklyVibe
        selectedVibe={formData.weeklyVibe}
        onChange={(vibe) =>
          setFormData((prev) => ({ ...prev!, weeklyVibe: vibe }))
        }
      />

      <InfluencingFactors
        selectedFactors={formData.influencingFactors}
        onChange={(factors) =>
          setFormData((prev) => ({ ...prev!, influencingFactors: factors }))
        }
      />

      <ScorecardRow
        data={journal.scoreCardData as unknown as ScoreCardData}
        units={user?.preferredUnits || "MGDL"}
      />

      {journal.clusters.map((cluster) => (
        <EventClusterCard
          key={cluster.id}
          cluster={cluster}
          userNote={formData.clusterNotes[cluster.id]}
          onNoteChange={(note) =>
            setFormData((prev) => ({
              ...prev!,
              clusterNotes: {
                ...prev!.clusterNotes,
                [cluster.id]: note,
              },
            }))
          }
        />
      ))}

      <ChartAnalysisCard
        title="Ambulatory Glucose Profile (AGP)"
        subtitle="Your 7-day glucose trends"
        data={normalizedAgpData}
        units={user?.preferredUnits || "MGDL"}
        insights={(journal.analysisInsights as unknown as Insight[]) || []}
      />

      <ContextualNotesArea
        notes={formData.goalsForNextWeek}
        setNotes={(notes) =>
          setFormData((prev) => ({ ...prev!, goalsForNextWeek: notes }))
        }
      />

      <div className="flex justify-center pt-8">
        <button
          onClick={() => void handleDelete()}
          className="flex items-center text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Delete Entry
        </button>
      </div>

      <StickyActionBar
        onSave={() => void handleSave()}
        onCancel={handleDiscard}
        isLoading={isSaving}
        error={saveError}
      />
    </div>
  );
}
