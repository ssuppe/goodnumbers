import React, { useState, useRef, useEffect } from "react";
import { PencilLine } from "lucide-react";

interface ContextualNotesAreaProps {
  notes: string;
  setNotes: (notes: string) => void;
}

const ContextualNotesArea: React.FC<ContextualNotesAreaProps> = ({
  notes,
  setNotes,
}) => {
  // 1. Ref for programmatic focusing
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 2. State to track expansion (starts expanded if content exists)
  const [isExpanded, setIsExpanded] = useState(notes.length > 0);

  const placeholderText =
    "Add anything else about how you feel or what you were up to this week";
  const shouldShowFullTextarea = isExpanded || notes.length > 0;

  // 3. EFFECT: Programmatically focus the textarea after expansion
  useEffect(() => {
    if (shouldShowFullTextarea && textareaRef.current && isExpanded) {
      // Ensures the cursor lands in the box after the initial click/focus
      textareaRef.current.focus();
    }
  }, [shouldShowFullTextarea, isExpanded]);

  // 4. BLUR HANDLER: Collapse if empty
  const handleBlur = () => {
    if (notes.length === 0) {
      setTimeout(() => setIsExpanded(false), 100);
    }
  };

  const commonClasses =
    "w-full p-3 border rounded-lg transition duration-150 text-gray-800";
  const focusClasses =
    "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";
  const inputStyle = `border-gray-300 ${focusClasses} bg-white shadow-sm`;
  const textareaStyle = `border-gray-300 resize-y ${focusClasses}`;

  return (
    <div className="space-y-4">
      {/* Title */}
      <h3 className="text-xl font-bold text-gray-800 flex items-center">
        <PencilLine
          className="inline-block w-5 h-5 mr-2"
          style={{ color: "#1976d2" }}
        />
        On reflection...
      </h3>

      <div className="bg-white p-2 rounded-xl shadow-md border border-gray-100">
        {!shouldShowFullTextarea ? (
          /* --- Collapsed Input (Single Line) --- */
          <input
            type="text"
            placeholder={placeholderText}
            className={`${commonClasses} ${inputStyle} py-2`}
            onFocus={() => setIsExpanded(true)}
            readOnly // Prevents soft keyboard pop-up until the final textarea is ready
          />
        ) : (
          /* --- Expanded Textarea (Multi-Line) --- */
          <div className="p-1">
            <textarea
              ref={textareaRef} // Attach ref
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholderText}
              rows={5}
              maxLength={2000}
              className={`${commonClasses} ${textareaStyle}`}
            />

            <div className="mt-3 text-right text-xs text-gray-500">
              {notes.length} characters
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextualNotesArea;
