import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { type JournalSummary } from "../../types/dashboard";

const vibeToEmojiMap: { [key: string]: string } = {
  Wilted: "🥀",
  Sprouting: "🌱",
  Growing: "🌿",
  Flourishing: "🌻",
};

export default function PastJournalsList({
  journals,
}: {
  journals: JournalSummary[];
}) {
  if (journals.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xl font-bold mb-4 text-gray-800">Past weeks</h2>
      <div className="space-y-4">
        {journals.map((journal) => (
          <div
            key={journal.id}
            className="bg-white p-4 rounded-xl shadow-sm flex items-start space-x-4 min-h-[4rem] border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 text-3xl pt-1">
              {vibeToEmojiMap[journal.weeklyVibe || ""] || "✨"}
            </div>
            <div className="flex-grow flex flex-col sm:flex-row justify-between items-start sm:items-center overflow-hidden">
              <div className="flex-grow overflow-hidden w-full sm:w-auto mb-2 sm:mb-0">
                <p className="text-xs font-semibold text-gray-500">
                  {format(new Date(journal.createdAt), "MMMM d, yyyy")}
                </p>
                <h3 className="font-bold truncate text-gray-900 leading-snug">
                  {journal.podcastTitle || "Untitled Journal"}
                </h3>
                <p className="text-gray-600 text-sm truncate mt-0.5">
                  {journal.podcastDescription || "No description available."}
                </p>
              </div>
              <Link
                to={`/journal/${journal.id}`}
                className="ml-0 sm:ml-4 flex-shrink-0 px-4 py-2 border border-blue-200 rounded-lg text-sm font-medium text-[#1976d2] hover:bg-blue-50 transition-colors flex items-center justify-center w-full sm:w-auto"
              >
                <Eye className="w-4 h-4 mr-2" /> View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
