import React, { useState } from "react";
import {
  Loader2,
  Sprout,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface StartJournalCardProps {
  isProcessing: boolean;
  isSubmitting: boolean;
  error: string | null;
  onStart: (data: { startDate?: string; endDate?: string }) => void;
}

export default function StartJournalCard({
  isProcessing,
  isSubmitting,
  error,
  onStart,
}: StartJournalCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleStart = () => {
    setLocalError(null);
    const data: { startDate?: string; endDate?: string } = {};

    if (showAdvanced) {
      if (!startDate || !endDate) {
        setLocalError("Please select both a start and end date.");
        return;
      }
      if (startDate > endDate) {
        setLocalError("Start date cannot be after end date.");
        return;
      }

      // Parse YYYY-MM-DD as LOCAL time, not UTC midnight
      const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
      const sDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);
      data.startDate = sDate.toISOString();

      const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
      const eDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      data.endDate = eDate.toISOString();
    }

    void onStart(data);
  };

  // 1. Processing State
  if (isProcessing) {
    return (
      <section className="bg-white p-4 rounded-xl shadow-lg mb-8 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-center sm:justify-start">
          <div className="w-24 h-24 bg-mesa-bg rounded-lg flex items-center justify-center flex-shrink-0 mr-4 mb-4 sm:mb-0">
            <Loader2
              data-testid="loader-icon"
              className="w-12 h-12 text-mesa-primary animate-spin"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Journal Processing...
            </h2>
            <p className="text-gray-600 mt-1">
              Your journal entry is being created. Refresh page to check status.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-4 text-center sm:text-left">
            {error}
          </p>
        )}
      </section>
    );
  }

  // 2. Default "Start New" State (Always Enabled)
  return (
    <section className="bg-white p-4 rounded-xl shadow-lg mb-8 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-center sm:justify-between">
        <div className="flex items-center mb-4 sm:mb-0">
          <div className="w-24 h-24 bg-mesa-bg rounded-lg flex items-center justify-center flex-shrink-0 mr-4">
            <Sprout className="w-12 h-12 text-mesa-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Reflect on your week
            </h2>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-mesa-primary text-sm font-medium hover:underline flex items-center mt-1"
            >
              {showAdvanced ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" /> Hide custom range
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" /> Custom analysis range
                </>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={handleStart}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-6 py-3 bg-mesa-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        >
          {isSubmitting && (
            <Loader2
              data-testid="loader-icon"
              className="animate-spin w-5 h-5 mr-2"
            />
          )}
          {isSubmitting ? "Starting..." : "Start Journal"}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mesa-primary focus:border-mesa-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mesa-primary focus:border-mesa-primary"
              />
            </div>
          </div>
          <p className="sm:col-span-2 text-xs text-gray-500 italic">
            Analyze a specific window of time. If left blank, the last 7 days
            will be analyzed.
          </p>
        </div>
      )}

      {(localError || error) && (
        <p className="text-red-500 text-sm mt-4 text-center sm:text-left">
          {localError || error}
        </p>
      )}
    </section>
  );
}
