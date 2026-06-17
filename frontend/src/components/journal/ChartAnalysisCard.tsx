import React, { useMemo, useState } from "react";
import { AgpChart, type AgpDataPoint } from "./charts/AgpChart";
import { type GlucoseUnit } from "../../lib/agpUtils";
import { InfoTooltip } from "../common/InfoTooltip";
import type { ScoreCardData } from "@goodnumbers/schemas";
import { ChevronDown } from "lucide-react";
import { UnifiedInsightRow } from "./UnifiedInsightRow";

export interface Insight {
  priority: string;
  note: string;
}

interface ChartAnalysisCardProps {
  title: string;
  subtitle?: string;
  data: AgpDataPoint[];
  units: GlucoseUnit;
  insights: Insight[];
  scoreCardData?: ScoreCardData | null;
}

export function ChartAnalysisCard({
  title,
  subtitle,
  data,
  units,
  insights,
  scoreCardData,
}: ChartAnalysisCardProps) {
  const [showInsights, setShowInsights] = useState(false);
  const tooltipContent = (
    <div className="space-y-2">
      <p className="font-bold border-b border-slate-700 pb-1 mb-2">
        Understanding the Chart
      </p>
      <div>
        <span className="font-semibold text-mesa-primary">Median:</span> The
        middle of your readings. Aim for this to be flat and in the green zone.
      </div>
      <div>
        <span className="font-semibold text-slate-300">50% of Readings</span>{" "}
        <span className="text-xs text-slate-400 font-normal">
          (Interquartile Range)
        </span>
        :
        <br />
        Half of your glucose readings fall in this darker band. A narrower band
        means more stability.
      </div>
      <div>
        <span className="font-semibold text-slate-400">90% of Readings</span>{" "}
        <span className="text-xs text-slate-500 font-normal">
          (5th-95th Percentile)
        </span>
        :
        <br />
        Almost all your readings fall here. This shows your variability and
        outliers.
      </div>
    </div>
  );

  // Helper to convert MGDL to MMOL for display
  const formatValue = (val: number | undefined, isPercentage = false) => {
    if (val === undefined || val === null) return "--";
    if (isPercentage) return Math.round(val).toString();
    if (units === "MMOL") {
      return (val / 18.0182).toFixed(1);
    }
    return Math.round(val).toString();
  };

  const formatUnit = (isPercentage = false) => {
    if (isPercentage) return "%";
    return units === "MGDL" ? "mg/dL" : "mmol/L";
  };

  // --- Insight Matching Logic ---
  const matchedInsights = useMemo(() => {
    const list = insights || [];
    return {
      gmi: list.find((i) => i.note.includes("estimated GMI")),
      avgGlucose: list.find((i) => i.note.includes("average glucose is")),
      // Match Hypo insight for Stability context?
      // Hypo insights start with bold headers usually.
      hypo: list.find(
        (i) =>
          i.note.includes("Celebrate the Win") ||
          i.note.includes("Stay the Course") ||
          i.note.includes("Prioritize Safety") ||
          i.note.includes("Medical Urgent"),
      ),
      // Match TIR insight
      tir: list.find(
        (i) =>
          i.note.includes("Focus on the Foundation") ||
          i.note.includes("Making Progress") ||
          i.note.includes("Goal Reached") ||
          i.note.includes("Outstanding Results"),
      ),
      overnight: list.find(
        (i) =>
          i.note.includes("Mastery Achieved") ||
          i.note.includes("Tight Range Success") ||
          i.note.includes("Building Stability") ||
          i.note.includes("Overnight Action Required"),
      ),
    };
  }, [insights]);

  // Extract GMI value from text if possible
  const gmiValue = useMemo(() => {
    if (!matchedInsights.gmi) return "--";
    const match = matchedInsights.gmi.note.match(/(\d+(?:\.\d+)?)%/);
    return match ? match[1] : "--";
  }, [matchedInsights.gmi]);

  const overnightData = useMemo(() => {
    if (!matchedInsights.overnight) return { value: "--", subtext: "" };

    // Extract percentage
    const pctMatch = matchedInsights.overnight.note.match(/\*\*(\d+)%\*\*/);
    const value = pctMatch ? pctMatch[1] : "--";

    // Determine subtext based on the bold header (Tier)
    let subtext = "In Range";
    const note = matchedInsights.overnight.note;
    if (note.includes("Mastery Achieved")) subtext = "Normal Range";
    else if (note.includes("Tight Range Success")) subtext = "Tight Range";
    else if (note.includes("Building Stability")) subtext = "Standard Range";
    else if (note.includes("Overnight Action Required"))
      subtext = "Standard Range";

    return { value, subtext };
  }, [matchedInsights.overnight]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center">
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              {title.includes("AGP") && (
                <InfoTooltip content={tooltipContent} />
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* --- Raw Metrics Grid (Top-level) --- */}
        {scoreCardData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* 1. Avg Glucose */}
            <div
              data-testid="metric-card-avg"
              className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-bold text-mesa-primary uppercase tracking-wider mb-1">
                Avg Glucose
              </span>
              <div className="flex items-baseline space-x-1">
                <span
                  data-testid="metric-value-avg"
                  className="text-2xl font-black text-slate-900"
                >
                  {formatValue(scoreCardData.avgGlucose)}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {formatUnit()}
                </span>
              </div>
            </div>

            {/* 2. Time In Range */}
            <div
              data-testid="metric-card-tir"
              className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                Time In Range
              </span>
              <div className="flex items-baseline space-x-1">
                <span
                  data-testid="metric-value-tir"
                  className="text-2xl font-black text-emerald-900"
                >
                  {formatValue(scoreCardData.timeInRange, true)}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                  %
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-1">
                Includes {formatValue(scoreCardData.timeInTightRange, true)}% in
                Tight Range
              </span>
            </div>

            {/* 3. Stability */}
            <div
              data-testid="metric-card-stability"
              className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">
                Stability (CV)
              </span>
              <div className="flex items-baseline space-x-1">
                <span
                  data-testid="metric-value-stability"
                  className="text-2xl font-black text-blue-900"
                >
                  {formatValue(scoreCardData.stability, true)}
                </span>
                <span className="text-[10px] font-bold text-blue-600 uppercase">
                  %
                </span>
              </div>
            </div>

            {/* 4. Time Below Range (TBR) */}
            <div
              data-testid="metric-card-tbr"
              className="bg-rose-50 p-3 rounded-lg border border-rose-100 flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                Time Below Range
              </span>
              <div className="flex items-baseline space-x-1">
                <span
                  data-testid="metric-value-tbr"
                  className="text-2xl font-black text-rose-900"
                >
                  {formatValue(scoreCardData.timeBelowRange, true)}
                </span>
                <span className="text-[10px] font-bold text-rose-600 uppercase">
                  %
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-2">
          <AgpChart data={data} units={units} />
        </div>

        {/* --- Collapsible Analysis & Insights (The "Zippy") --- */}
        {scoreCardData && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="flex items-center text-sm font-bold text-mesa-secondary hover:text-mesa-primary transition-colors group"
            >
              <ChevronDown
                className={`w-4 h-4 mr-1.5 transition-transform duration-300 ${
                  showInsights ? "rotate-180" : ""
                }`}
              />
              {showInsights
                ? "Hide Detailed Analysis"
                : "View Detailed Analysis"}
            </button>

            {showInsights && (
              <div className="mt-4 space-y-1 animate-in slide-in-from-top-2 duration-300">
                <UnifiedInsightRow
                  label="Avg Glucose"
                  value={formatValue(scoreCardData.avgGlucose)}
                  unit={formatUnit()}
                  icon="🧭"
                  iconColor="text-mesa-primary"
                  insight={
                    matchedInsights.avgGlucose?.note ||
                    "Your average blood sugar over the last 7 days."
                  }
                />

                <UnifiedInsightRow
                  label="Stability (CV)"
                  value={formatValue(scoreCardData.stability, true)}
                  unit="%"
                  icon="🌊"
                  iconColor="text-mesa-secondary"
                  insight="Measures your glycemic variability (Coefficient of Variation). A lower CV indicates more stable glucose and fewer swings."
                />

                <UnifiedInsightRow
                  label="Time Below Range"
                  value={formatValue(scoreCardData.timeBelowRange, true)}
                  unit="%"
                  icon="⚠️"
                  iconColor="text-rose-600"
                  insight={
                    matchedInsights.hypo?.note ||
                    "Percentage of time spent below target range (< 70 mg/dL)."
                  }
                />

                <UnifiedInsightRow
                  label="Time In Range"
                  value={formatValue(scoreCardData.timeInRange, true)}
                  unit="%"
                  icon="⛵"
                  iconColor="text-emerald-600"
                  insight={
                    matchedInsights.tir?.note ||
                    "Percentage of time spent in your target range (70-180 mg/dL)."
                  }
                />

                {matchedInsights.overnight && (
                  <UnifiedInsightRow
                    label="Overnight Control"
                    value={overnightData.value}
                    unit="%"
                    subtext={overnightData.subtext}
                    icon="🌙"
                    iconColor="text-indigo-900"
                    insight={matchedInsights.overnight.note}
                  />
                )}

                {matchedInsights.gmi && (
                  <UnifiedInsightRow
                    label="GMI (Est. A1c)"
                    value={gmiValue}
                    unit="%"
                    icon="📈"
                    iconColor="text-purple-600"
                    insight={matchedInsights.gmi.note}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
