// src/components/tideline/TidelineDailyChartWrapper.tsx
'use client'; // <--- IMPORTANT: Mark this as a Client Component

import React, { useEffect, useRef, useState } from 'react';
import type { ComponentProps, RefAttributes } from 'react'; // Import types for props and refs

// Dynamically import the JavaScript component to ensure it's only loaded client-side
// Adjust the path './DailyView.js' if your file structure is different.
// The 'await import(...)' syntax requires async components or specific Next.js config,
// let's use the standard dynamic import for simplicity within useEffect or conditional rendering.
// Or, a simple import might work if build system handles it, but dynamic is safer for client-only code.
import OriginalDailyComponent from './DailyView.js'; // Try this first

// If the above import causes issues during build (tries to run server-side), use dynamic import:
// import dynamic from 'next/dynamic';
// const OriginalDailyComponent = dynamic(() => import('./DailyView.js'), { ssr: false });

// --- Define Props for the Original JavaScript Component ---
// Based on the PropTypes in DailyView.js. This gives us type safety in the wrapper.
interface OriginalDailyProps {
  addingData: { inProgress?: boolean; completed?: boolean /* add other fields if needed */ };
  chartPrefs: {
    daily?: { bgSource?: 'cbg' | 'smbg' /* add other prefs */ };
    bolusRatio?: number;
    dynamicCarbs?: boolean;
    // Add other chartPrefs properties based on the original component's needs
  };
  data: {
    // This is a complex object, define the essential parts
    data?: { combined?: any[] }; // Array of diabetes data points
    metaData?: {
      bgSources?: { cbg?: boolean; smbg?: boolean };
      devices?: any[];
      latestPumpUpload?: {
        isAutomatedBasalDevice?: boolean;
        isAutomatedBolusDevice?: boolean;
      };
    };
    timePrefs?: {
      timezoneAware?: boolean;
      timezoneName?: string;
    };
    bgPrefs?: {
      bgUnits: 'mg/dL' | 'mmol/L';
      bgClasses: Record<string, { boundary: number }>; // e.g., { low: { boundary: 70 }, target: { boundary: 180 } }
      useDefaultRange?: boolean; // Added based on usage in UNSAFE_componentWillReceiveProps
    };
    query?: { chartType?: string }; // Added based on usage in render
    // Add other data properties needed
  };
  initialDatetimeLocation?: string;
  loading: boolean;
  mostRecentDatetimeLocation?: string;
  queryDataCount: number; // Added based on usage in UNSAFE_componentWillReceiveProps
  stats: any[]; // Define more specifically if possible
  updatingDatum: { inProgress?: boolean; completed?: boolean /* add other fields */ };
  patient?: object; // Define more specifically if possible

  // Handlers (Callbacks)
  onClickRefresh: () => void;
  onCreateMessage: (message: any) => void; // Define message type if known
  onShowMessageThread: (message?: any) => void; // Define message type if known
  onSwitchToBasics: () => void;
  onSwitchToDaily: (datetime?: string) => void; // Assuming it takes optional datetime
  onClickPrint: (pdf?: any) => void; // Define pdf type if known
  onSwitchToSettings: () => void;
  onSwitchToBgLog: (datetime?: string) => void;
  onSwitchToTrends: (datetime?: string) => void;
  onUpdateChartDateRange: (endDate: string, goToMostRecent?: boolean) => void;
  updateChartPrefs: (prefs: any, isUserInteraction?: boolean, isDataUpdate?: boolean) => void; // Define prefs type if known
  trackMetric: (eventName: string, properties?: Record<string, any>) => void;
  removeGeneratedPDFS?: () => void; // Optional based on DeviceSelection usage

  // Add any other props expected by the original Daily component
  // Optional props from DailyChart passed through Daily
  bolusRatio?: number;
  dynamicCarbs?: boolean;

  // i18n props (if using react-i18next and need parent control)
  // t?: TFunction; // Type from i18next if needed here

  // Props for the underlying DailyChart that might be passed through
  // bgClasses and bgUnits are derived from data.bgPrefs
  // timePrefs is derived from data.timePrefs
  // etc.
}

// --- Define Props for our TypeScript Wrapper ---
// These are the props you'll pass TO this wrapper component from your Next.js page/component
interface TidelineDailyChartWrapperProps {
  // Example: Pass prepared data structures
  chartData: OriginalDailyProps['data'];
  chartPrefs: OriginalDailyProps['chartPrefs'];
  patientInfo?: OriginalDailyProps['patient'];
  initialDate?: string; // Map to initialDatetimeLocation
  isLoading: boolean;
  statsData: OriginalDailyProps['stats'];
  mostRecentDate?: string; // Map to mostRecentDatetimeLocation

  // You might simplify callbacks or fetch data within the wrapper
  // Example simplified props:
  onDateChange?: (startDate: string, endDate: string) => void;
  onTrackEvent?: OriginalDailyProps['trackMetric'];

  // Pass through necessary handlers from the parent Next.js component
  // Make sure to include ALL required handlers from OriginalDailyProps
  onClickRefresh: () => void;
  onCreateMessage: (message: any) => void;
  onShowMessageThread: (message?: any) => void;
  onSwitchToBasics: () => void;
  onSwitchToDaily: (datetime?: string) => void;
  onClickPrint: (pdf?: any) => void;
  onSwitchToSettings: () => void;
  onSwitchToBgLog: (datetime?: string) => void;
  onSwitchToTrends: (datetime?: string) => void;
  onUpdateChartPrefs: OriginalDailyProps['updateChartPrefs'];
  onRemoveGeneratedPDFS?: OriginalDailyProps['removeGeneratedPDFS'];
}

// Define the type for the ref if you need to call methods like closeMessageThread
// This requires the original component to be structured to expose these via refs,
// which the example does using `withRef: true` and potentially forwardRef.
// However, the example uses a React.createRef() internally, accessing methods via `this.chartRef.current?.method()`.
// Calling methods *from the outside* might require modifying DailyView.js to use `useImperativeHandle`.
// For now, let's assume we don't need to call methods externally via ref.

const TidelineDailyChartWrapper: React.FC<TidelineDailyChartWrapperProps> = (props) => {
  // State to manage props that might change or need defaults
  // Ensure we pass stable objects/functions if possible
  const {
    chartData,
    chartPrefs,
    patientInfo,
    initialDate,
    isLoading,
    statsData,
    mostRecentDate,
    onDateChange, // Example simplified handler
    onTrackEvent, // Example simplified handler
    ...restHandlers // Pass through all other required handlers
  } = props;

  // The original component seems complex regarding data updates (`UNSAFE_componentWillReceiveProps`).
  // Passing props directly *should* work, but monitor for issues where the chart doesn't update.
  // React 18+ might handle some scenarios better than older versions.

  // --- Prepare Props for the Original Component ---
  // This mapping ensures the JS component gets exactly what it expects.
  const originalProps: OriginalDailyProps = {
    // Fake props for things potentially managed internally or not needed yet
    // Adjust these based on actual requirements
    addingData: {}, // Provide realistic value if needed
    updatingDatum: {}, // Provide realistic value if needed
    queryDataCount: chartData?.data?.combined?.length ?? 0, // Example derived value

    // Pass mapped or direct props
    data: chartData,
    chartPrefs: chartPrefs,
    patient: patientInfo,
    initialDatetimeLocation: initialDate,
    loading: isLoading,
    stats: statsData,
    mostRecentDatetimeLocation: mostRecentDate,

    // Map simplified handlers or pass directly
    onUpdateChartDateRange: (endDate) => {
      // The original handler gets the *end* of the previous range.
      // The component itself calculates the new range internally.
      // We might need more info (like the start date) if the parent needs the full new range.
      // The JS component calls this on navigation end.
      console.log('Chart date range updated, new end date:', endDate);
      if (onDateChange) {
        // You might need to get the *start* date from the chart component ref if needed.
        // For now, just pass what we have.
        // onDateChange(startDate, endDate);
      }
    },
    trackMetric: (eventName, properties) => {
      console.log('Track Metric:', eventName, properties);
      if (onTrackEvent) {
        onTrackEvent(eventName, properties);
      }
    },

    // Pass through the rest of the handlers directly
    ...restHandlers,
    updateChartPrefs: function (prefs: any, isUserInteraction?: boolean, isDataUpdate?: boolean): void {
      throw new Error('Function not implemented.');
    },
  };

  // Render the original component only when essential data is available?
  // The original component has its own Loader, so maybe render immediately.
  if (!chartData || !chartPrefs) {
    // Or render a placeholder/loader specific to the wrapper
    return <div>Loading chart data...</div>;
  }

  // Render the imported JavaScript component
  return <OriginalDailyComponent {...originalProps} />;
};

export default TidelineDailyChartWrapper;
