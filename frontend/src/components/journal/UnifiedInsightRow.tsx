import React from "react";

interface UnifiedInsightRowProps {
  label: string;
  value: string | number;
  unit: string;
  subtext?: string;
  insight: string; // Changed to string to ensure we can parse it
  icon: string;
  iconColor?: string; // Tailwind text color class, e.g., "text-mesa-primary"
}

export function UnifiedInsightRow({
  label,
  value,
  unit,
  subtext,
  insight,
  icon,
  iconColor = "text-gray-900",
}: UnifiedInsightRowProps) {
  // Helper to parse **bold** text without a full markdown library
  const renderInsight = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="py-3 flex items-start gap-4">
      {/* Icon: Transparent bg, shadow for depth */}
      <div className={`text-2xl drop-shadow-sm ${iconColor} select-none`}>
        {icon}
      </div>

      {/* Grid: Precise alignment between metric and text */}
      <div className="flex-grow grid grid-cols-1 md:grid-cols-[160px_1fr] items-start gap-2 md:gap-8">
        <div className="metric-group flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-900">
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">{value}</span>
            <span className="text-xs font-medium text-gray-500">{unit}</span>
          </div>
          {subtext && (
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight mt-0.5">
              {subtext}
            </span>
          )}
        </div>
        <div className="insight-text text-sm leading-relaxed text-gray-700">
          {renderInsight(insight)}
        </div>
      </div>
    </div>
  );
}
