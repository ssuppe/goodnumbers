import DataDisplayWidget from "./DataDisplayWidget";
import type { GlycemicEventCluster } from "@goodnumbers/types";

interface EventClusterCardProps {
  cluster: GlycemicEventCluster;
  userNote?: string;
  onNoteChange?: (note: string) => void;
}

export default function EventClusterCard({
  cluster,
  userNote,
  onNoteChange,
}: EventClusterCardProps) {
  // We create a dynamic title to make the output clearer
  const title = `Glycemic Event Cluster: ${cluster.eventType} (x${cluster.eventCount})`;

  return (
    <div className="space-y-4">
      {/* We pass the entire cluster object to see all its data, including the summary fields. */}
      <DataDisplayWidget title={title} data={cluster} />

      {/* User Notes Section */}
      {onNoteChange && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <label
            htmlFor={`cluster-note-${cluster.id}`}
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Your Notes
          </label>
          <textarea
            id={`cluster-note-${cluster.id}`}
            value={userNote || ""}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Why do you think this happened? Leave some notes on what you think the issue is, or how you can improve next week. If you don’t know, that's ok! Leave it blank."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            rows={3}
            maxLength={1000}
          />
          <div className="mt-1 text-right text-xs text-gray-500">
            {(userNote || "").length}/1000 characters
          </div>
        </div>
      )}
    </div>
  );
}
