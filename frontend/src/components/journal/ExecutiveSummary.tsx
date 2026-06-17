import React from "react";
import { type Highlight } from "@goodnumbers/types";

interface ExecutiveSummaryProps {
  highlights: Highlight[];
}

export default function ExecutiveSummary({
  highlights,
}: ExecutiveSummaryProps) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {highlights.map((h, i) => {
        const bgClass =
          h.type === "win"
            ? "bg-emerald-50 border-emerald-100"
            : h.type === "warn" ||
                h.type === "focus" ||
                h.type === "opportunity"
              ? "bg-amber-50 border-amber-100"
              : "bg-blue-50 border-blue-100";

        const textClass =
          h.type === "win"
            ? "text-emerald-800"
            : h.type === "warn" ||
                h.type === "focus" ||
                h.type === "opportunity"
              ? "text-amber-800"
              : "text-blue-800";

        return (
          <div
            key={i}
            className={`p-3 rounded-xl shadow-sm border ${bgClass} transition-all hover:shadow-md`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl shrink-0" role="img" aria-label={h.type}>
                {h.icon}
              </span>
              <h4
                className={`font-bold text-sm uppercase tracking-wide ${textClass}`}
              >
                {h.title}
              </h4>
            </div>
            <p className="mt-1.5 text-[13px] text-slate-700 leading-snug">
              {h.short_description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
