import React, { useMemo, useState } from "react";
import type {
  GlycemicEventCluster,
  GlycemicCluster,
  Insight,
} from "@goodnumbers/types";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import CollapsingNoteArea from "./CollapsingNoteArea";
import ClusterChatInterface from "./ClusterChatInterface";
import { type GlucoseUnit, type Treatment } from "../../lib/agpUtils";
import { ChevronDown, ChevronRight, Copy, Check, Sparkles } from "lucide-react";

interface EventClusterCardProps {
  cluster: GlycemicEventCluster;
  userNote?: string;
  onNoteChange?: (note: string) => void;
  units?: string;
  treatments?: Treatment[];
  insights?: Insight[];
  showTimezone?: boolean;
}

export interface AiInsight {
  assessment: string;
  reflectionForDoctor?: string;
  quickLogSuggestions?: string[];
  initialPrompt?: string;
}

// Helper to format minutes into HH:MM using robust string padding.
// Immune to local computer DST transitions or timezone settings.
export function minutesToTimeString(minutes: number): string {
  // Round to nearest 15 minutes
  const roundedMinutes = Math.round(minutes / 15) * 15;
  const h = Math.floor(roundedMinutes / 60) % 24;
  const m = roundedMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
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
function AiAssessmentDisplay({
  assessment,
  reflectionForDoctor,
}: {
  assessment?: string;
  reflectionForDoctor?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);

  // Handle assessment text
  const textContent = assessment || "";

  const handleCopyDoctorNote = async () => {
    if (!reflectionForDoctor) return;
    try {
      await navigator.clipboard.writeText(reflectionForDoctor);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy doctor note", err);
    }
  };

  // Split legacy/structured assessment text by the known headers
  const renderStructuredText = (text: string) => {
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

    if (sections.length === 0) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
    return <div className="space-y-4">{sections}</div>;
  };

  return (
    <div className="space-y-6">
      {/* Primary Assessment */}
      <div className="assessment-body">{renderStructuredText(textContent)}</div>

      {/* Doctor Reflection Section (Stage 2) */}
      {reflectionForDoctor && (
        <div className="mt-4 p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="font-bold text-blue-800 text-[10px] uppercase tracking-wider">
              For your Doctor
            </p>
            <button
              onClick={() => {
                void handleCopyDoctorNote();
              }}
              className="flex items-center space-x-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy for Doctor</span>
                </>
              )}
            </button>
          </div>
          <p className="text-gray-700 italic border-l-2 border-blue-200 pl-3 py-1">
            {reflectionForDoctor}
          </p>
        </div>
      )}
    </div>
  );
}

// Human-friendly mapping for common offsets when IANA names are unavailable.
// We prioritize major global hubs and handle common DST shifts.
const OFFSET_CITY_MAP: Record<number, string> = {
  [-600]: "Hawaii",
  [-540]: "Alaska",
  [-480]: "Los Angeles",
  [-420]: "Los Angeles / Denver",
  [-360]: "Chicago",
  [-300]: "New York / Chicago",
  [-240]: "New York",
  [-180]: "Buenos Aires",
  [-120]: "Mid-Atlantic",
  [-60]: "Azores",
  [0]: "London",
  [60]: "London / Paris", // Handles London Summer or Paris Winter
  [120]: "Paris / Athens", // Handles Paris Summer or Athens Winter
  [180]: "Moscow / Dubai",
  [240]: "Dubai",
  [300]: "Karachi",
  [330]: "Mumbai",
  [420]: "Bangkok",
  [480]: "Singapore / Hong Kong",
  [540]: "Tokyo",
  [600]: "Sydney",
  [660]: "Noumea",
  [720]: "Auckland",
};

/**
 * Converts IANA zone or offset string into a human-friendly location name.
 * e.g. "America/New_York" -> "New York"
 * e.g. "Etc/GMT+4" -> "New York" (via mapping)
 */
function getFriendlyLocationName(
  zoneName: string | undefined,
  offsetMinutes: number,
): string {
  // If we have a standard IANA name (America/New_York), extract the city
  if (zoneName && zoneName.includes("/") && !zoneName.startsWith("Etc/")) {
    const parts = zoneName.split("/");
    return parts[parts.length - 1].replace(/_/g, " ");
  }

  // Fallback to our curated offset map for common travel locations
  if (OFFSET_CITY_MAP[offsetMinutes]) {
    return OFFSET_CITY_MAP[offsetMinutes];
  }

  // Final fallback: Use Intl API to try and find a localized name for the offset
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "long",
      timeZone: zoneName,
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (
      tzPart &&
      !tzPart.value.includes("GMT") &&
      !tzPart.value.includes("UTC")
    ) {
      return tzPart.value;
    }
  } catch {
    // Ignore errors
  }

  // Absolute fallback
  const hours = Math.abs(offsetMinutes) / 60;
  return `GMT${offsetMinutes >= 0 ? "+" : "-"}${hours}`;
}

export default function EventClusterCard({
  cluster,
  userNote,
  onNoteChange,
  units = "MGDL",
  treatments,
  insights,
  showTimezone,
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

  // Safe parsing of AI Insight (Stage 2)
  const parsedAiInsight = useMemo((): AiInsight | null => {
    try {
      if (!cluster.aiInsight) return null;
      if (typeof cluster.aiInsight === "string") {
        return { assessment: cluster.aiInsight, reflectionForDoctor: "" };
      }
      // Cast through unknown to the refined interface
      return cluster.aiInsight as unknown as AiInsight;
    } catch (e) {
      console.error("Failed to parse aiInsight", e);
      return null;
    }
  }, [cluster.aiInsight]);

  // Calculate time range if event data is available
  const timeRange = useMemo(() => {
    if (!clusterData || !clusterData.events || clusterData.events.length === 0)
      return null;

    const startTimes = clusterData.events.map((e) => e.startMinuteOfDay);
    const min = Math.min(...startTimes);
    const max = Math.max(...startTimes);

    // Spread check: If the spread is > 12 hours (720 mins), we definitely have a midnight wraparound
    const isWraparound = max - min > 720;

    let earliest, latest;

    if (isWraparound) {
      // In a wraparound, the "earliest" events are actually the ones with the largest minute values
      // (e.g., 23:30 is "earlier" in the cluster than 00:30)
      const afterMidnight = startTimes.filter((t) => t < 720);
      const beforeMidnight = startTimes.filter((t) => t >= 720);

      earliest = Math.min(...beforeMidnight);
      latest = Math.max(...afterMidnight);
    } else {
      earliest = min;
      latest = max;
    }

    const earliestStr = minutesToTimeString(earliest);
    const latestStr = minutesToTimeString(latest);

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

  const summaryText = useMemo(() => {
    const timeRangeStr = timeRange
      ? `(between ${timeRange.earliest} and ${timeRange.latest})`
      : "";
    const baseSummary = `${cluster.eventCount} ${colloquialType} events occurred around ${meanTimeStr} ${timeRangeStr}`;

    if (!showTimezone || !clusterData?.timezone) {
      return baseSummary;
    }

    const locationName = getFriendlyLocationName(
      clusterData.timezone,
      clusterData.utcOffset ?? 0,
    );
    const offset = clusterData.utcOffset ?? 0;
    const hours = Math.abs(offset) / 60;
    const sign = offset >= 0 ? "+" : "-";
    const offsetStr = `GMT${sign}${hours}`;

    return `${baseSummary} in ${locationName} (${offsetStr})`;
  }, [
    cluster.eventCount,
    colloquialType,
    meanTimeStr,
    timeRange,
    showTimezone,
    clusterData?.timezone,
    clusterData?.utcOffset,
  ]);

  // Generate dynamic title using the full summary structure as requested
  const title = summaryText;

  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);

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

  const handleCopyData = async () => {
    const dataToCopy = {
      clusterHeader: {
        id: cluster.id,
        eventType: cluster.eventType,
        meanTimeMinutes: cluster.meanTimeMinutes,
        eventCount: cluster.eventCount,
      },
      clusterData,
      treatments,
      insights: displayInsights,
      maxEvidenceWindow,
    };

    const text = JSON.stringify(dataToCopy, null, 2);
    console.log(`[Debug] Prepared ${text.length} characters for clipboard.`);

    try {
      // Primary: Modern Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
      } else {
        // Fallback: Textarea selection (works in non-secure contexts)
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Ensure it's not visible but exists in DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand("copy");
          if (successful) {
            setIsCopied(true);
          } else {
            console.error("ExecCommand copy was unsuccessful");
          }
        } catch (err) {
          console.error("Fallback copy failed", err);
        }
        document.body.removeChild(textArea);
      }
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy chart data", err);
    }
  };

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
          <div className="flex-grow">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => {
                void handleCopyData();
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center space-x-1"
              title="Copy chart data for debugging"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-100 whitespace-nowrap">
              {Math.max(maxEvidenceWindow, 60)}m lookback
            </span>
          </div>
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
                  <AiAssessmentDisplay
                    assessment={parsedAiInsight?.assessment}
                    reflectionForDoctor={parsedAiInsight?.reflectionForDoctor}
                  />

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
            {isChatActive ? (
              <ClusterChatInterface
                journalId={cluster.journalId}
                clusterId={cluster.id}
                initialPrompt={
                  parsedAiInsight?.initialPrompt ||
                  "Hi! I'm your AI Reflection Coach. How do you think we can improve this in the future?"
                }
                onSaveInsight={(synthesizedText) => {
                  onNoteChange(synthesizedText);
                  setIsChatActive(false);
                }}
                onClose={() => setIsChatActive(false)}
              />
            ) : (
              <>
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
                <button
                  type="button"
                  onClick={() => setIsChatActive(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 mt-2 bg-transparent text-brand border border-mesa-primary hover:bg-primary-hover hover:text-white rounded-lg transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Help me reflect</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
