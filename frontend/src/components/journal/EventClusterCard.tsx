import React, { useMemo } from "react";
import type {
  GlycemicEventCluster,
  GlycemicCluster,
  Insight,
} from "@goodnumbers/types";
import { InsightPriority } from "@goodnumbers/types";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import CollapsingNoteArea from "./CollapsingNoteArea";
import { format } from "date-fns";
import { type GlucoseUnit, type Treatment } from "../../lib/agpUtils";

interface EventClusterCardProps {
  cluster: GlycemicEventCluster;
  userNote?: string;
  onNoteChange?: (note: string) => void;
  units?: string;
  treatments?: Treatment[];
  insights?: Insight[];
}

// Helper to format minutes into HH:MM using date-fns for consistency
export function minutesToTimeString(minutes: number): string {
  // Round to nearest 15 minutes
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const h = Math.floor(roundedMinutes / 60);
  const m = roundedMinutes % 60;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return format(date, "HH:mm");
}

// Helper to get colloquial event name
export function getColloquialEventName(type: string): string {
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

// Helper for styling (match ChartAnalysisCard)
const getBgColor = (priority: InsightPriority) => {
  switch (priority) {
    case InsightPriority.CRITICAL:
      return "bg-red-50 border-red-100 text-red-900";
    case InsightPriority.SERIOUS:
      return "bg-amber-50 border-amber-100 text-amber-900";
    case InsightPriority.IMPORTANT:
      return "bg-blue-50 border-blue-100 text-blue-900";
    default:
      return "bg-gray-50 border-gray-100 text-gray-700";
  }
};

export default function EventClusterCard({
  cluster,
  userNote,
  onNoteChange,
  units = "MGDL",
  treatments,
  insights,
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

    // Check for wraparound (e.g. 23:00 and 01:00)
    // If the spread is > 12 hours (720 mins), we assume it wraps around midnight
    const isWraparound = max - min > 720;

    const earliestStr = minutesToTimeString(isWraparound ? max : min);
    const latestStr = minutesToTimeString(isWraparound ? min : max);

    // If the rounded times are identical, don't show a range
    if (earliestStr === latestStr) return null;

    return {
      earliest: earliestStr,
      latest: latestStr,
    };
  }, [clusterData]);

  // Generate summary text
  const meanTimeStr = minutesToTimeString(cluster.meanTimeMinutes);
  const colloquialType = getColloquialEventName(cluster.eventType);

  const summaryText = timeRange
    ? `${cluster.eventCount} ${colloquialType} events occurred around ${meanTimeStr} (between ${timeRange.earliest} and ${timeRange.latest})`
    : `${cluster.eventCount} ${colloquialType} events occurred around ${meanTimeStr}`;

  // Generate dynamic title using the full summary structure as requested
  const title = summaryText;

  // Use insights prop if provided, otherwise fallback to cluster.insights if it matches the shape
  const displayInsights =
    insights || (cluster.insights as unknown as Insight[]);

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Top Section: Title and Chart */}
      <div className="p-4 pb-2">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <div className="w-full">
          {clusterData ? (
            <ClusterEventsChart
              cluster={clusterData}
              units={units as GlucoseUnit}
              treatments={treatments}
            />
          ) : (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
              Unable to load visualization data.
            </div>
          )}
        </div>
      </div>

      {/* Insight Section */}
      {displayInsights && displayInsights.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Analysis
          </h4>
          {displayInsights.map((i, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm border ${getBgColor(i.priority)}`}
            >
              {/* SECURITY: React escapes children by default. Do NOT use dangerouslySetInnerHTML */}
              {i.note}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Section: Integrated User Notes */}
      {onNoteChange && (
        <div className="px-4 pb-6 pt-2">
          <div className="mt-2 pt-4 border-t border-gray-100">
            <label
              htmlFor={`cluster-note-${cluster.id}`}
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Notes
            </label>
            <CollapsingNoteArea
              value={userNote || ""}
              onChange={onNoteChange}
              placeholder="Why do you think this happened? Leave some notes on what you think the issue is, or how you can improve next week. If you don’t know, that's ok! Leave it blank."
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}
