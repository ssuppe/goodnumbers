import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJournalStatus } from "../hooks/useJournalStatus";
import { Loader2, AlertTriangle } from "lucide-react";

export default function JournalLoadingPage() {
  const { journalId } = useParams<{ journalId: string }>();
  const navigate = useNavigate();
  const { status, progress, statusMessage, error } =
    useJournalStatus(journalId);

  useEffect(() => {
    if (status === "COMPLETE") {
      navigate(`/journal/${journalId}`, { replace: true });
    }
  }, [status, journalId, navigate]);

  const isFailed = status === "FAILED";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white p-8 rounded-xl shadow-lg m-4">
      {isFailed ? (
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      ) : (
        <Loader2 className="animate-spin w-16 h-16 text-mesa-primary mb-4" />
      )}
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
        {isFailed ? "Generation Failed" : "Generating Your Journal..."}
      </h1>

      {!isFailed && progress > 0 && (
        <div className="flex items-center space-x-2 mb-4">
          {[1, 2, 3].map((step) => {
            const isActive =
              (step === 1 && progress <= 20) ||
              (step === 2 && progress > 20 && progress <= 50) ||
              (step === 3 && progress > 50 && progress < 100);
            const isCompleted =
              (step === 1 && progress > 20) ||
              (step === 2 && progress > 50) ||
              (step === 3 && progress === 100);

            return (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-mesa-primary text-white"
                      : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? "✓" : step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      isCompleted ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p
        className={`text-gray-600 text-lg text-center max-w-md mb-8 ${isFailed ? "text-red-600" : ""}`}
      >
        {error || statusMessage || "Please wait a moment."}
      </p>

      {!isFailed && (
        <div className="w-full max-w-md">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
            className="w-full bg-gray-200 rounded-full h-2.5"
          >
            <div
              className="bg-mesa-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400 font-medium">
            <span>DATA</span>
            <span>STATS</span>
            <span>AI</span>
          </div>
        </div>
      )}
    </div>
  );
}
