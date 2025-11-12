import { useState } from "react";
import { PlayCircle } from "lucide-react";

interface PodcastPlayerProps {
  title: string | null;
  description: string | null;
  audioUrl: string | null;
}

export default function PodcastPlayer({
  title,
  description,
  audioUrl,
}: PodcastPlayerProps) {
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);

  if (!audioUrl) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center text-gray-500">
        No podcast audio available for this journal.
      </div>
    );
  }

  return (
    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {title || "Weekly Summary"}
      </h2>
      <p className="text-gray-600 mb-6">
        {description || "Listen to your personalized summary."}
      </p>

      {isPlayerLoaded ? (
        <audio
          controls
          src={audioUrl}
          className="w-full"
          data-testid="audio-player"
        >
          Your browser does not support the audio element.
        </audio>
      ) : (
        <button
          onClick={() => setIsPlayerLoaded(true)}
          className="w-full p-4 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <PlayCircle className="w-6 h-6 mr-3" />
          Click to load AI discussion on your numbers
        </button>
      )}
    </section>
  );
}
