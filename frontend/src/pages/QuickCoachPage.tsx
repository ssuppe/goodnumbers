import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api, updateJournal } from "../lib/api";
import { type Journal, type GlycemicEventCluster } from "@goodnumbers/types";
import { Loader2, AlertTriangle, Sparkles, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import QuickCoachStoryPlayer from "../components/coach/QuickCoachStoryPlayer";
import QuickCoachVoiceNegotiation from "../components/coach/QuickCoachVoiceNegotiation";

type JournalResponse = Journal & {
  clusters: GlycemicEventCluster[];
};

export default function QuickCoachPage() {
  const { journalId } = useParams<{ journalId: string }>();
  const [journal, setJournal] = useState<JournalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyFinished, setStoryFinished] = useState(false);
  const [agreedGoal, setAgreedGoal] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!journalId) return;
    const fetchJournal = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.get<JournalResponse>(`/journals/${journalId}`);
        setJournal(res.data);
        if (res.data.goalsForNextWeek) {
          setAgreedGoal(res.data.goalsForNextWeek);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchJournal();
  }, [journalId]);

  const handleSaveGoal = async () => {
    if (!journalId || !agreedGoal.trim()) return;
    try {
      setIsSaving(true);
      await updateJournal(journalId, {
        goalsForNextWeek: agreedGoal,
      });
      setSaveSuccess(true);
    } catch (err: unknown) {
      console.error("Failed to save goal:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="loading-spinner"
        className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-4"
      >
        <Loader2 className="w-10 h-10 animate-spin text-[#D9775B]" />
        <p className="mt-4 text-sm font-medium text-gray-600">
          Preparing your Quick Coach session...
        </p>
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Unable to load coaching session
        </h2>
        <p className="text-sm text-gray-600 max-w-md mb-6">
          {error || "We could not find the requested journal data."}
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2C4C5B] text-white text-sm font-semibold hover:bg-[#233c48] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  const primaryCluster =
    journal.clusters.find((c) => c.isPrimaryFocus) || journal.clusters[0];

  const dateRangeLabel =
    journal.startDate && journal.endDate
      ? `${format(new Date(journal.startDate), "MMM d")} – ${format(new Date(journal.endDate), "MMM d, yyyy")}`
      : "Weekly Review";

  const startHour = primaryCluster
    ? Math.floor(primaryCluster.meanTimeMinutes / 60)
    : 0;
  const startMin = primaryCluster
    ? (primaryCluster.meanTimeMinutes % 60).toString().padStart(2, "0")
    : "00";
  const patternTimeStr = `${startHour}:${startMin}`;

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-gray-900 flex flex-col justify-between max-w-lg mx-auto pb-24 shadow-sm">
      {/* Header */}
      <header className="px-4 pt-6 pb-3 flex items-center justify-between border-b border-[#E8E1D9]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#D9775B] text-white shadow-sm">
            ⚡
          </span>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#2C4C5B]">
              Quick Coach
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {dateRangeLabel}
            </p>
          </div>
        </div>

        <Link
          to={`/journal/${journal.id}`}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 bg-white/70 px-2.5 py-1.5 rounded-lg border border-[#E8E1D9] transition-colors"
        >
          Full Journal
        </Link>
      </header>

      {/* Main Focus Banner or Empty State */}
      {primaryCluster ? (
        <main className="flex-1 px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E8E1D9] shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D9775B]/10 text-[#D9775B]">
                <Sparkles className="w-3.5 h-3.5" /> Primary Weekly Hotspot
              </span>
              <span className="text-xs font-bold text-gray-500">
                Occurred {primaryCluster.eventCount}x
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {primaryCluster.eventType === "hyper"
                ? "High Blood Sugar Pattern"
                : "Low Blood Sugar Pattern"}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Typical onset around{" "}
              <span className="font-semibold">{patternTimeStr}</span>
            </p>
          </div>

          {/* Animated Story Player */}
          <QuickCoachStoryPlayer
            cluster={primaryCluster}
            onStoryEnd={() => setStoryFinished(true)}
          />

          {/* Voice Reflection & Negotiation Section */}
          <QuickCoachVoiceNegotiation
            journalId={journal.id}
            clusterId={primaryCluster.id}
            isStoryFinished={storyFinished}
            initialGoal={agreedGoal}
            onGoalAgreed={(goal) => setAgreedGoal(goal)}
          />
        </main>
      ) : (
        <main className="flex-1 px-4 py-8 text-center space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-[#E8E1D9] shadow-sm space-y-3">
            <span className="text-4xl">🎉</span>
            <h2 className="text-lg font-bold text-gray-900">
              No Recurring Patterns Detected!
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
              Your numbers were steady this week without recurring high or low
              hotspots. Keep up the great work!
            </p>
            <div className="pt-2">
              <Link
                to={`/journal/${journal.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2C4C5B] text-white text-xs font-semibold hover:bg-[#233c48] transition-colors"
              >
                View Full Weekly Report
              </Link>
            </div>
          </div>
        </main>
      )}

      {/* Sticky Bottom Action Bar for Handshake */}
      {agreedGoal && !saveSuccess && (
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-[#E8E1D9] flex items-center justify-between gap-3 shadow-lg z-40">
          <div className="flex-1 truncate">
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
              Agreed Micro-Habit
            </p>
            <p className="text-xs font-semibold text-gray-800 truncate">
              {agreedGoal}
            </p>
          </div>
          <button
            onClick={() => void handleSaveGoal()}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#D9775B] text-white font-bold text-sm shadow-md hover:bg-[#c2654a] active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Accept & Save"
            )}
          </button>
        </div>
      )}

      {/* Success Celebration Banner */}
      {saveSuccess && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-[#E8E1D9] space-y-4">
            <div className="text-5xl animate-bounce">🎉</div>
            <h3 className="text-xl font-bold text-gray-900">
              Micro-Habit Locked In!
            </h3>
            <p className="text-xs text-gray-600">
              "{agreedGoal}" has been saved to your weekly journal.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to={`/journal/${journal.id}`}
                className="w-full py-3 rounded-xl bg-[#2C4C5B] text-white font-bold text-sm hover:bg-[#233c48] transition-colors"
              >
                View Full Journal
              </Link>
              <Link
                to="/dashboard"
                className="w-full py-2.5 rounded-xl text-gray-500 font-semibold text-xs hover:text-gray-800 transition-colors"
              >
                Close & Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
