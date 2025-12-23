import React, { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  content: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
}

export function InfoTooltip({
  content,
  trigger,
  className = "ml-2",
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="More information"
      >
        {trigger ? trigger : <Info className="w-4 h-4" />}
      </button>

      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none">
          {content}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}
