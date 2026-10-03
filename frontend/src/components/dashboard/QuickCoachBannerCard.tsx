import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Zap, Loader2, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";

interface QuickCoachBannerCardProps {
  isProcessing: boolean;
}

export default function QuickCoachBannerCard({
  isProcessing,
}: QuickCoachBannerCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStartCoach = async () => {
    setIsSubmitting(true);
    setError(null);
    setErrorCode(null);

    try {
      const response = await api.post<{ journalId: string; status: string }>(
        "/coach/sessions",
      );
      navigate(`/journal/${response.data.journalId}/loading?target=coach`);
    } catch (err: unknown) {
      // Extract structured error from API response
      const apiErr = err as {
        response?: { data?: { error?: string; code?: string } };
        message?: string;
      };
      const data = apiErr.response?.data;
      setErrorCode(data?.code || null);
      setError(
        data?.error || "Failed to start coaching session. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isProcessing || isSubmitting;

  return (
    <section
      aria-label="Quick Coach Section"
      className="bg-gradient-to-r from-orange-50 via-amber-50/40 to-white p-5 sm:p-6 rounded-xl shadow-md mb-8 border border-orange-200/80 transition-shadow hover:shadow-lg"
    >
      <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 text-mesa-primary">
            <Zap className="w-7 h-7 fill-mesa-primary text-mesa-primary" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-orange-200/80 text-orange-800 rounded-full">
                Audio &amp; Voice
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Quick Coach: 3-Minute Glycemic Debrief
              </h2>
            </div>
            <p className="text-gray-600 text-sm sm:text-base mt-1 max-w-xl">
              Distill your last 7 days of CGM data into a single high-impact
              pattern with an audio breakdown and micro-habit negotiation.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            void handleStartCoach();
          }}
          disabled={isDisabled}
          aria-busy={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-mesa-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[190px] flex-shrink-0"
        >
          {isSubmitting ? (
            <>
              <Loader2
                data-testid="loader-icon"
                className="animate-spin w-5 h-5 mr-2"
              />
              Preparing...
            </>
          ) : isProcessing ? (
            "Session in progress..."
          ) : (
            "⚡ Start Quick Coach (3 min)"
          )}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <span>{error}</span>
          {errorCode === "NIGHTSCOUT_REQUIRED" && (
            <Link
              to="/setup"
              className="inline-flex items-center text-mesa-primary font-medium hover:underline text-sm flex-shrink-0"
            >
              Configure Nightscout in Settings
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
