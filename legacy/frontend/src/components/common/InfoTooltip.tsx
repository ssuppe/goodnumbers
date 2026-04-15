import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Update position when tooltip becomes visible
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const updatePosition = () => {
        const rect = triggerRef.current!.getBoundingClientRect();
        setPosition({
          top: rect.top - 8, // 8px spacing above the trigger
          left: rect.left + rect.width / 2,
        });
      };

      updatePosition();
      // Optional: update on scroll/resize to keep it attached if the user scrolls while hovering
      window.addEventListener("scroll", updatePosition);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isVisible]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label="More information"
      >
        {trigger ? trigger : <Info className="w-4 h-4" />}
      </button>

      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg pointer-events-none"
            style={{
              top: position.top,
              left: position.left,
              transform: "translate(-50%, -100%)", // Center horizontally, move up by 100% of height
            }}
          >
            {content}
            {/* Arrow (Visual only, pointing down) */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>,
          document.body,
        )}
    </div>
  );
}
