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
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
      ) : (
        <Loader2 className="animate-spin w-16 h-16 text-mesa-primary mb-6" />
      )}
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
        {isFailed ? "Generation Failed" : "Generating Your Journal..."}
      </h1>
      <p
        className={`text-gray-600 text-lg text-center max-w-md ${isFailed ? "text-red-600" : ""}`}
      >
        {error || statusMessage || "Please wait a moment."}
      </p>

      {!isFailed && (
        <div className="w-full max-w-md mt-6">
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
        </div>
      )}
    </div>
  );
}
