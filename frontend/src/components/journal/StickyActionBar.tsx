import React from "react";

interface StickyActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
}

const StickyActionBar: React.FC<StickyActionBarProps> = ({
  onSave,
  onCancel,
  isLoading,
  error,
}) => {
  const primaryColor = "#1976d2";
  const buttonBaseClasses =
    "py-2 px-4 rounded-lg font-semibold text-base transition-all duration-200 w-full sm:w-auto";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white shadow-xl border-t-2 border-gray-200">
      <div className="max-w-4xl mx-auto p-3">
        {error && (
          <div className="mb-2 text-center text-red-600 font-medium">
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={`${buttonBaseClasses} text-gray-700 border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Discard
          </button>

          <button
            onClick={onSave}
            disabled={isLoading}
            style={{ backgroundColor: isLoading ? undefined : primaryColor }}
            className={`${buttonBaseClasses} text-white shadow-md hover:shadow-lg disabled:bg-blue-400 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickyActionBar;
