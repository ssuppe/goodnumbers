import React, { useMemo, useState } from "react";
import type {
  GlycemicEventCluster,
  GlycemicCluster,
  Insight,
} from "@goodnumbers/types";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import CollapsingNoteArea from "./CollapsingNoteArea";
import { format } from "date-fns";
import { type GlucoseUnit, type Treatment } from "../../lib/agpUtils";
import { ChevronDown, ChevronRight } from "lucide-react";

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

// Sub-component to parse and render structured AI insights
function AiAssessmentDisplay({ text }: { text: string }) {
  // Split by the known headers, keeping the headers in the result
  const parts = text.split(
    /(Key takeaway or observation:|Recommendation:|In detail:)/gi,
  );

  const sections: React.ReactNode[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i].trim();
    const content = parts[i + 1]?.trim();

    if (content) {
      sections.push(
        <div key={header} className="space-y-1">
          <p className="font-bold text-blue-800 text-[10px] uppercase tracking-wider">
            {header.replace(":", "")}
          </p>
          <div className="text-gray-900 leading-relaxed">
            {header.includes("Recommendation") ? (
              <ul className="list-disc ml-4 space-y-1">
                {content.split("\n").map((line, idx) => {
                  // Remove leading bullets/dashes if the AI added them
                  const cleanLine = line.replace(/^[*-]\s*/, "").trim();
                  return cleanLine ? <li key={idx}>{cleanLine}</li> : null;
                })}
              </ul>
            ) : (
              <p>{content}</p>
            )}
          </div>
        </div>,
      );
    }
  }

  // Fallback to plain text if parsing fails to find sections
  if (sections.length === 0) {
    return <div className="whitespace-pre-wrap italic">{text}</div>;
  }

  return <div className="space-y-4">{sections}</div>;
}

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

  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(false);

  // Use insights prop if provided, otherwise fallback to cluster.insights if it matches the shape
  const displayInsights =
    insights || (cluster.insights as unknown as Insight[]);

  // Calculate the maximum evidence window across all insights to adjust the chart Zoom
  const maxEvidenceWindow = useMemo(() => {
    if (!displayInsights || displayInsights.length === 0) return 0;
    return Math.max(
      0,
      ...displayInsights
        .map((i) => i.evidenceWindowMins || 0)
        .filter((val) => typeof val === "number"),
    );
  }, [displayInsights]);

  // Parse quick log suggestions
  const quickLogSuggestions = useMemo(() => {
    try {
      if (typeof cluster.quickLogSuggestions === "string") {
        return JSON.parse(cluster.quickLogSuggestions) as string[];
      }
      if (Array.isArray(cluster.quickLogSuggestions)) {
        return cluster.quickLogSuggestions as string[];
      }
    } catch (e) {
      console.error("Failed to parse quick log suggestions", e);
    }
    return [];
  }, [cluster.quickLogSuggestions]);

  const handleQuickLog = (suggestion: string) => {
    if (onNoteChange) {
      const currentNote = userNote || "";
      const newNote = currentNote
        ? `${currentNote.trim()}\n- ${suggestion}`
        : `- ${suggestion}`;
      onNoteChange(newNote);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Top Section: Title and Chart */}
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex-grow">{title}</h3>
          <span className="flex-shrink-0 ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-100">
            {Math.max(maxEvidenceWindow, 60)}m lookback
          </span>
        </div>
        <div className="w-full">
          {clusterData ? (
            <ClusterEventsChart
              cluster={clusterData}
              units={units as GlucoseUnit}
              treatments={treatments}
              evidenceWindowMins={maxEvidenceWindow}
            />
          ) : (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
              Unable to load visualization data.
            </div>
          )}
        </div>
      </div>

      {/* Insight Section */}
      {((displayInsights && displayInsights.length > 0) ||
        cluster.aiInsight) && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {displayInsights && displayInsights.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                className="flex items-center space-x-1 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
              >
                {isAnalysisExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span>Data Analysis</span>
              </button>

              {isAnalysisExpanded && (
                <div className="space-y-1.5 pt-1">
                  {displayInsights.map((i, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 rounded-md text-[11px] bg-gray-50 border border-gray-100 text-gray-600 leading-tight"
                    >
                      {/* SECURITY: React escapes children by default. Do NOT use dangerouslySetInnerHTML */}
                      {i.note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {cluster.aiInsight && (
            <div className="space-y-3">
              <button
                onClick={() => setIsAiExpanded(!isAiExpanded)}
                className="flex items-center space-x-1 w-full text-left"
              >
                <div className="flex items-center space-x-2 flex-grow">
                  <span className="text-sm">✨</span>
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    AI Co-pilot Hypothesis
                  </h4>
                </div>
                {isAiExpanded ? (
                  <ChevronDown className="w-4 h-4 text-blue-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                )}
              </button>

              {isAiExpanded && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-800 leading-relaxed shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
                  <AiAssessmentDisplay text={cluster.aiInsight} />

                  {quickLogSuggestions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-100">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                        Quick Log Suggestions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickLogSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickLog(suggestion)}
                            className="px-3 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-full hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                          >
                            + {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
