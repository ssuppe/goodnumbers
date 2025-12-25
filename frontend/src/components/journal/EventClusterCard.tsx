import React, { useMemo } from "react";
import type { GlycemicEventCluster, GlycemicCluster } from "@goodnumbers/types";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import { format } from "date-fns";

interface EventClusterCardProps {
  cluster: GlycemicEventCluster;
  userNote?: string;
  onNoteChange?: (note: string) => void;
}

// Helper to format minutes into HH:MM using date-fns for consistency
function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, "HH:mm");
}

// Helper to get colloquial event name
function getColloquialEventName(type: string): string {
  const upperType = type.toUpperCase();
  if (["HYPER", "HIGH", "VERY_HIGH"].includes(upperType)) {
    return "high blood sugar";
  }
  if (
    ["HYPO", "HYPOGLYCEMIA", "SEVERE_HYPOGLYCEMIA", "LOW"].includes(upperType)
  ) {
    return "low blood sugar";
  }
  return type;
}

export default function EventClusterCard({
  cluster,
  userNote,
  onNoteChange,
}: EventClusterCardProps) {
  // Safe parsing of the JSON blob
  const clusterData = useMemo(() => {
    try {
      if (typeof cluster.clusterDataJson === "string") {
        return JSON.parse(cluster.clusterDataJson) as GlycemicCluster;
      }
      if (
        typeof cluster.clusterDataJson === "object" &&
        cluster.clusterDataJson !== null
      ) {
        return cluster.clusterDataJson as unknown as GlycemicCluster;
      }
    } catch (e) {
      console.error("Failed to parse cluster data", e);
    }
    return null;
  }, [cluster.clusterDataJson]);

  // Calculate time range if event data is available
  const timeRange = useMemo(() => {
    if (!clusterData || !clusterData.events || clusterData.events.length === 0)
      return null;

    const startTimes = clusterData.events.map((e) => e.startMinuteOfDay);
    const min = Math.min(...startTimes);
    const max = Math.max(...startTimes);

    return {
      earliest: minutesToTimeString(min),
      latest: minutesToTimeString(max),
    };
  }, [clusterData]);

  // Generate summary text
  const meanTimeStr = minutesToTimeString(cluster.meanTimeMinutes);
  const colloquialType = getColloquialEventName(cluster.eventType);

  const summaryText = timeRange
    ? `${cluster.eventCount} ${colloquialType} events occurred around ${meanTimeStr} (between ${timeRange.earliest} and ${timeRange.latest})`
    : `${cluster.eventCount} ${colloquialType} events occurred around ${meanTimeStr}`;

  // Generate dynamic title using the full summary structure as requested
  // "4 high blood sugar events occurred around 20:48 (between 19:23 and 21:59)"
  const title = summaryText;

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        {/* Structured Header */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex flex-wrap gap-6 mb-3">
              <div className="flex items-center text-gray-700">
                <span className="text-xl mr-2" role="img" aria-label="Time">
                  🕒
                </span>
                <div>
                  <span className="text-xs text-gray-500 block uppercase tracking-wide font-semibold">
                    Time of Day
                  </span>
                  <span className="font-medium">{meanTimeStr}</span>
                </div>
              </div>

              <div className="flex items-center text-gray-700">
                <span className="text-xl mr-2" role="img" aria-label="Count">
                  🔁
                </span>
                <div>
                  <span className="text-xs text-gray-500 block uppercase tracking-wide font-semibold">
                    Event Count
                  </span>
                  <span className="font-medium">
                    {cluster.eventCount} events
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed"></p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="w-full">
          {clusterData ? (
            <ClusterEventsChart cluster={clusterData} units="MGDL" />
          ) : (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
              Unable to load visualization data.
            </div>
          )}
        </div>
      </div>

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
