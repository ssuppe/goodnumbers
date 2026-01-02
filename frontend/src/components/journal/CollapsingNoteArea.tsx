import React, { useState, useRef, useEffect } from "react";

interface CollapsingNoteAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}

const CollapsingNoteArea: React.FC<CollapsingNoteAreaProps> = ({
  value,
  onChange,
  placeholder = "Leave a note...",
  maxLength = 1000,
  rows = 3,
  className = "",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(value.length > 0);

  const shouldShowFullTextarea = isExpanded || value.length > 0;

  useEffect(() => {
    if (shouldShowFullTextarea && textareaRef.current && isExpanded) {
      textareaRef.current.focus();
    }
  }, [shouldShowFullTextarea, isExpanded]);

  const handleBlur = () => {
    if (value.length === 0) {
      setTimeout(() => setIsExpanded(false), 100);
    }
  };

  const commonClasses =
    "w-full p-3 border rounded-lg transition duration-150 text-gray-800 outline-none";
  const focusClasses =
    "focus:ring-2 focus:ring-mesa-primary focus:border-mesa-primary border-gray-300";

  return (
    <div className={`w-full ${className}`}>
      {!shouldShowFullTextarea ? (
        <input
          type="text"
          placeholder={placeholder}
          className={`${commonClasses} ${focusClasses} py-2 bg-white shadow-sm text-sm cursor-text`}
          onFocus={() => setIsExpanded(true)}
          readOnly
        />
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className={`${commonClasses} ${focusClasses} resize-y text-sm`}
          />

          <div className="mt-1 text-right text-xs text-gray-400">
            {value.length} / {maxLength} characters
          </div>
        </div>
      )}
    </div>
  );
};

export default CollapsingNoteArea;
