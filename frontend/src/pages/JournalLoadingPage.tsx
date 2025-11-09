import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function JournalLoadingPage() {
  const { journalId } = useParams<{ journalId: string }>();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white p-8 rounded-xl shadow-lg m-4">
      <Loader2 className="animate-spin w-16 h-16 text-[#1976d2] mb-6" />
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
        Generating Your Journal...
      </h1>
      <p className="text-gray-600 text-lg text-center max-w-md">
        This takes a few moments while we analyze your data and create your
        personalized podcast.
      </p>
      <p className="text-sm text-gray-400 mt-4">
        Journal ID:{" "}
        <span className="font-mono text-xs bg-gray-100 p-1 rounded">
          {journalId || "N/A"}
        </span>
      </p>
    </div>
  );
}
