import { ChartErrorBoundary } from "../components/journal/charts/ChartErrorBoundary";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, updateJournal, deleteJournal } from "../lib/api";
import { type Journal, type GlycemicEventCluster } from "@goodnumbers/types";
import { type ScoreCardData } from "@goodnumbers/schemas";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";

import PodcastPlayer from "../components/journal/PodcastPlayer";
import {
  ChartAnalysisCard,
  type Insight,
} from "../components/journal/ChartAnalysisCard";
import {
  normalizeAgpData,
  type RawAgpDataPoint,
  type Treatment,
} from "../lib/agpUtils";
import { useAuth } from "../contexts/AuthContext";
import WeeklyVibe from "../components/journal/WeeklyVibe";
import InfluencingFactors from "../components/journal/InfluencingFactors";
import EventClusterCard from "../components/journal/EventClusterCard";
import CollapsingNoteArea from "../components/journal/CollapsingNoteArea";
import StickyActionBar from "../components/journal/StickyActionBar";
import ExecutiveSummary from "../components/journal/ExecutiveSummary";
import { type Highlight } from "@goodnumbers/types";
import { PencilLine } from "lucide-react";
import ClusterChatInterface from "../components/journal/ClusterChatInterface";

import { format } from "date-fns";

type JournalResponse = Journal & {
  clusters: GlycemicEventCluster[];
  treatments?: Treatment[];
  executiveSummary?: Highlight[];
};

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
  const [activeChatClusterId, setActiveChatClusterId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    const fetchJournal = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<JournalResponse>(`/journals/${id}`);

        // Treatments are now included in the response.data
        setJournal({
          ...response.data,
          treatments: response.data.treatments || [],
        });

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
            journal.agpChartData as unknown as RawAgpDataPoint[],
            user?.preferredUnits || "MGDL",
          )
        : [],
    [journal?.agpChartData, user?.preferredUnits],
  );

  const activeCluster = useMemo(() => {
    if (!activeChatClusterId || !journal) return null;
    return journal.clusters.find((c) => c.id === activeChatClusterId) || null;
  }, [activeChatClusterId, journal]);

  const activeClusterInitialPrompt = useMemo(() => {
    if (!activeCluster) return "";
    try {
      if (!activeCluster.aiInsight) return "";
      if (typeof activeCluster.aiInsight === "string") return "";
      const insight = activeCluster.aiInsight as { initialPrompt?: string };
      return insight.initialPrompt || "";
    } catch {
      return "";
    }
  }, [activeCluster]);

  const getRangeLabel = () => {
    if (journal?.startDate && journal?.endDate) {
      return `${format(new Date(journal.startDate), "MMM d")} - ${format(
        new Date(journal.endDate),
        "MMM d, yyyy",
      )}`;
    }
    // Fallback for older journals: assume 7 days ending at createdAt
    const end = new Date(journal!.createdAt);
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-8">
        {/* Updated: Using Mesa Primary (Terracotta) for the Loader */}
        <Loader2 className="animate-spin w-8 h-8 text-mesa-primary" />
        <span className="ml-3 text-lg text-mesa-text">
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
    <div className="max-w-4xl mx-auto p-4 sm:p-4 lg:p-8 space-y-3 pb-20">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Analysis for {getRangeLabel()}
        </h1>
      </div>

      <PodcastPlayer
        title={journal.podcastTitle}
        description={journal.podcastDescription}
        audioUrl={journal.podcastAudioUrl}
      />

      {journal.executiveSummary && (
        <section className="animate-in fade-in slide-in-from-top-2 duration-500">
          <ExecutiveSummary highlights={journal.executiveSummary} />
        </section>
      )}

      <ChartErrorBoundary>
        <ChartAnalysisCard
          title="Ambulatory Glucose Profile (AGP)"
          subtitle="Your 7-day glucose trends"
          data={normalizedAgpData}
          units={user?.preferredUnits || "MGDL"}
          insights={(journal.analysisInsights as unknown as Insight[]) || []}
          scoreCardData={journal.scoreCardData as unknown as ScoreCardData}
        />
      </ChartErrorBoundary>

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

      {journal.clusters.map((cluster) => {
        // Determine if this journal spans multiple timezones
        const uniqueOffsets = new Set(
          journal.clusters.map((c) => {
            try {
              const data = (
                typeof c.clusterDataJson === "string"
                  ? JSON.parse(c.clusterDataJson)
                  : c.clusterDataJson
              ) as GlycemicCluster;
              return data?.utcOffset;
            } catch {
              return null;
            }
          }),
        );
        const hasMultipleTimezones =
          uniqueOffsets.size > 1 &&
          Array.from(uniqueOffsets).filter((o) => o !== null).length > 1;

        return (
          <ChartErrorBoundary key={cluster.id}>
            <EventClusterCard
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
              units={user?.preferredUnits || "MGDL"}
              treatments={journal.treatments}
              showTimezone={hasMultipleTimezones}
              isChatActive={activeChatClusterId === cluster.id}
              onHelpReflect={() => setActiveChatClusterId(cluster.id)}
            />
          </ChartErrorBoundary>
        );
      })}

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-gray-800 flex items-center">
          <PencilLine className="inline-block w-5 h-5 mr-2 text-mesa-primary" />
          On reflection...
        </h3>
        <div className="bg-white p-2 rounded-xl shadow-md border border-gray-100">
          <CollapsingNoteArea
            value={formData.goalsForNextWeek}
            onChange={(notes) =>
              setFormData((prev) => ({ ...prev!, goalsForNextWeek: notes }))
            }
            placeholder="Add anything else about how you feel or what you were up to this week"
            maxLength={2000}
            rows={5}
          />
        </div>
      </section>

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

      {activeChatClusterId && (
        <ClusterChatInterface
          key={activeChatClusterId}
          journalId={id!}
          clusterId={activeChatClusterId}
          initialPrompt={
            activeClusterInitialPrompt ||
            "Hi! I'm your AI Reflection Coach. How do you think we can improve this in the future?"
          }
          onSaveInsight={(synthesizedText) => {
            setFormData((prev) => ({
              ...prev!,
              clusterNotes: {
                ...prev!.clusterNotes,
                [activeChatClusterId]: synthesizedText,
              },
            }));
            setActiveChatClusterId(null);
          }}
          onClose={() => setActiveChatClusterId(null)}
        />
      )}
    </div>
  );
}
