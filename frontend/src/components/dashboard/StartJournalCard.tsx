import { format, addDays } from "date-fns";
import { Loader2, Sprout } from "lucide-react"; // Using Sprout for both states

interface StartJournalCardProps {
  isEnabled: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClick: () => void;
  latestJournalDate: Date | undefined;
}

export default function StartJournalCard({
  isEnabled,
  isSubmitting,
  error,
  onClick,
  latestJournalDate,
}: StartJournalCardProps) {
  const unlockDate = latestJournalDate
    ? addDays(latestJournalDate, 3)
    : undefined;
  const formattedUnlockDate = unlockDate
    ? format(unlockDate, "MMMM d, yyyy")
    : "";

  return (
    <section className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
      {isEnabled ? (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between">
          <div className="flex items-center mb-4 sm:mb-0">
            {/* Placeholder for image */}
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
      ) : (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between">
          <div className="flex items-center mb-4 sm:mb-0">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
              <Sprout className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-700">
              Your next journal unlocks on{" "}
              <span className="text-[#1976d2]">{formattedUnlockDate}</span>.
              Come back then to reflect.
            </h2>
          </div>
          <button
            disabled
            className="w-full sm:w-auto px-6 py-3 bg-[#1976d2] text-white font-semibold rounded-lg shadow-md opacity-50 cursor-not-allowed flex items-center justify-center"
          >
            Start Journal
          </button>
        </div>
      )}
      {error && (
        <p className="text-red-500 text-sm mt-4 text-center sm:text-left">
          {error}
        </p>
      )}
    </section>
  );
}
