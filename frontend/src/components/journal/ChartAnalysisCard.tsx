import React, { useMemo } from "react";
import { AgpChart, type AgpDataPoint } from "./charts/AgpChart";
import { type GlucoseUnit } from "../../lib/agpUtils";
import { InfoTooltip } from "../common/InfoTooltip";
import { UnifiedInsightRow } from "./UnifiedInsightRow";
import type { ScoreCardData } from "@goodnumbers/schemas";

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
  patientLowGoal?: number;
  patientHighGoal?: number;
}

export function ChartAnalysisCard({
  title,
  subtitle,
  data,
  units,
  insights,
  scoreCardData,
  patientLowGoal,
  patientHighGoal,
}: ChartAnalysisCardProps) {
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
    };
  }, [insights]);

  // Extract GMI value from text if possible
  const gmiValue = useMemo(() => {
    if (!matchedInsights.gmi) return "--";
    const match = matchedInsights.gmi.note.match(/(\d+(?:\.\d+)?)%/);
    return match ? match[1] : "--";
  }, [matchedInsights.gmi]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {title.includes("AGP") && <InfoTooltip content={tooltipContent} />}
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}

        <div className="mt-4 mb-6">
          <AgpChart
            data={data}
            units={units}
            patientLowGoal={patientLowGoal}
            patientHighGoal={patientHighGoal}
          />
        </div>

        {/* --- Insights Ledger --- */}
        {scoreCardData && (
          <div className="px-2 sm:px-6 divide-y divide-gray-100 border-t border-gray-100 pt-2">
            {/* 1. Avg Glucose */}
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

            {/* 2. Stability (using Hypo insight as proxy for safety/stability context if available) */}
            <UnifiedInsightRow
              label="Stability"
              value={formatValue(scoreCardData.stability, true)}
              unit="%"
              icon="🌊"
              iconColor="text-mesa-secondary"
              insight={
                matchedInsights.hypo?.note ||
                "Measures how often your glucose levels were changing slowly. High stability means fewer sudden drops or spikes."
              }
            />

            {/* 3. Time In Range */}
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

            {/* 4. Time In Tight Range */}
            <UnifiedInsightRow
              label="Time In Tight Range"
              value={formatValue(scoreCardData.timeInTightRange, true)}
              unit="%"
              icon="🏝️"
              iconColor="text-teal-600"
              insight="Percentage of time spent in the ideal tight range (70-140 mg/dL). This is your 'island of calm'."
            />

            {/* 5. GMI (Only if insight exists) */}
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
    </div>
  );
}
