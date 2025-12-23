import React from "react";
import { type ScoreCardData } from "@goodnumbers/schemas";
import MetricScorecard from "./MetricScorecard";

interface ScorecardRowProps {
  data: ScoreCardData | null | undefined;
  units: "MGDL" | "MMOL";
}

export default function ScorecardRow({ data, units }: ScorecardRowProps) {
  if (!data) return null;

  // Helper to convert MGDL to MMOL if needed
  const formatGlucose = (val: number) => {
    if (units === "MMOL") {
      return (val / 18.0182).toFixed(1);
    }
    return Math.round(val).toString();
  };

  const formatTrend = (val: number | undefined) => {
    if (val === undefined || val === null) return undefined;
    if (units === "MMOL") {
      // For trends, we keep 1 decimal place for MMOL
      return parseFloat((val / 18.0182).toFixed(1));
    }
    return Math.round(val);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 hide-scrollbar">
      <MetricScorecard
        label="Avg Glucose"
        value={formatGlucose(data.avgGlucose)}
        unit={units === "MGDL" ? "mg/dL" : "mmol/L"}
        icon="🧭"
        colorClass="bg-blue-600"
        tooltip="Your average blood sugar over the last 7 days."
        trend={formatTrend(data.trends?.avgGlucose)}
        inverseTrend={true} // Lower is better
      />
      <MetricScorecard
        label="Stability"
        value={`${Math.round(data.stability)}%`}
        icon="🌊"
        colorClass="bg-indigo-600"
        percentage={data.stability}
        tooltip="Percentage of time your glucose was changing slowly (< 1.5 mg/dL/min)."
        trend={data.trends?.stability}
      />
      <MetricScorecard
        label="Time In Range"
        value={`${Math.round(data.timeInRange)}%`}
        icon="⛵"
        colorClass="bg-emerald-600"
        percentage={data.timeInRange}
        tooltip="Percentage of time between 70-180 mg/dL."
        trend={data.trends?.timeInRange}
      />
      <MetricScorecard
        label="Time In Tight Range"
        value={`${Math.round(data.timeInTightRange)}%`}
        icon="🏝️"
        colorClass="bg-teal-600"
        percentage={data.timeInTightRange}
        tooltip="Percentage of time between 70-140 mg/dL."
        trend={data.trends?.timeInTightRange}
      />
    </div>
  );
}
