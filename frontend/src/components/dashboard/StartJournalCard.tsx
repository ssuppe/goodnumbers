import { Loader2, Sprout } from "lucide-react";

interface StartJournalCardProps {
  isProcessing: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClick: () => void;
}

export default function StartJournalCard({
  isProcessing,
  isSubmitting,
  error,
  onClick,
}: StartJournalCardProps) {
  // 1. Processing State
  if (isProcessing) {
    return (
      <section className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center sm:justify-start">
          <div className="w-24 h-24 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mr-4 mb-4 sm:mb-0">
            <Loader2
              data-testid="loader-icon"
              className="w-12 h-12 text-[#1976d2] animate-spin"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Journal Processing...
            </h2>
            <p className="text-gray-600 mt-1">
              Your journal entry is being created. Refresh page to check status.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-4 text-center sm:text-left">
            {error}
          </p>
        )}
      </section>
    );
  }

  // 2. Default "Start New" State (Always Enabled)
  return (
    <section className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-center sm:justify-between">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
            <Sprout className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Reflect on your week
          </h2>
        </div>
        <button
          onClick={onClick}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-[#1976d2] text-white font-semibold rounded-lg shadow-md hover:bg-[#1e88e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isSubmitting && (
            <Loader2
              data-testid="loader-icon"
              className="animate-spin w-5 h-5 mr-2"
            />
          )}
          {isSubmitting ? "Starting..." : "Start Journal"}
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-4 text-center sm:text-left">
          {error}
        </p>
      )}
    </section>
  );
}
