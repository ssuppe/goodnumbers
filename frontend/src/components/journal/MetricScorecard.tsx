import React from "react";
import {
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { InfoTooltip } from "../common/InfoTooltip";

interface MetricScorecardProps {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon | string;
  colorClass: string;
  percentage?: number;
  tooltip?: string;
  trend?: number | null; // Signed delta
  inverseTrend?: boolean; // If true, negative trend = Green (Good)
}

export default function MetricScorecard({
  label,
  value,
  unit,
  icon,
  colorClass,
  percentage,
  tooltip,
  trend,
  inverseTrend = false,
}: MetricScorecardProps) {
  let TrendIcon = Minus;
  let trendColor = "text-gray-400";
  const absTrend = trend ? Math.abs(trend) : 0;

  if (trend !== undefined && trend !== null && trend !== 0) {
    if (trend > 0) {
      TrendIcon = ArrowUp;
      trendColor = inverseTrend ? "text-amber-600" : "text-green-600";
    } else {
      TrendIcon = ArrowDown;
      trendColor = inverseTrend ? "text-green-600" : "text-amber-600";
    }
  }

  const renderIcon = () => {
    if (typeof icon === "string") {
      return <span className="text-xl leading-none">{icon}</span>;
    }
    const IconComponent = icon;
    return (
      <IconComponent
        className={`w-5 h-5 ${colorClass.replace("bg-", "text-")}`}
      />
    );
  };

  return (
    <div className="relative flex flex-col p-4 rounded-xl border border-gray-100 bg-white min-w-[160px] flex-1 shadow-sm hover:border-gray-200 transition-colors group">
      <div className="flex justify-between items-start mb-2">
        <div
          className={`p-2 rounded-lg flex items-center justify-center w-9 h-9`}
        >
          {renderIcon()}
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`text-xs font-bold flex items-center gap-0.5 ${trend === 0 ? "text-gray-400" : trendColor}`}
          >
            {trend === 0 ? (
              <Minus className="w-3 h-3" />
            ) : (
              <TrendIcon className="w-3 h-3" />
            )}
            {trend !== 0 && absTrend}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {tooltip && (
          <InfoTooltip
            content={tooltip}
            trigger={<HelpCircle className="w-3 h-3 text-gray-300" />}
            className="ml-1"
          />
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {unit && (
          <span className="text-sm text-gray-500 font-medium">{unit}</span>
        )}
      </div>
      {percentage !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-100 rounded-b-xl overflow-hidden">
          <div
            className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
}
