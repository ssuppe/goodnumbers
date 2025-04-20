'use client';

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { decompress } from 'compress-json';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useLoadingState } from '@/hooks/useLoadingState';
import { AssessmentData, ReportType } from '@/types/nightscout.d';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import ReactMarkdown from 'react-markdown';
import * as prettier from 'prettier/standalone';
import parserXml from '@prettier/plugin-xml';
import { readAssessmentDemoData } from '@/services/demoDataService';
import { ssmlToMarkdown } from '@/utils/ssml-client';
import PodcastStatusBadge from './PodcastStatusBadge';
import { ReportItemDisplay } from '../charts/AgpReportItemDisplay';
import { ClusterReportRenderer } from '../report/ClusterReportRenderer';
import Headline from '../atoms/Headline';
import WidgetWrapper from '../atoms/WidgetWrapper';

// Hardcoded demo ID
const DEMO_ID = 'demo1';

// Function to check if debug mode is enabled via URL parameter
function isDebugMode(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('debug') === '1';
    } catch (e) {
      // If there's an error parsing URL params, default to false
      console.error('Error checking debug mode:', e);
      return false;
    }
  }
  return false;
}

interface NightscoutDemoProps {
  header?: Header;
  id?: string;
  hasBackground?: boolean;
}

const NightscoutDemo = ({
  header,
  id,
  hasBackground = false,
}: NightscoutDemoProps): JSX.Element => {
  // State management with our existing hooks
  const { assessmentData, error: storageError, updateAssessmentData, getCurrentPodcastResult } = useAssessmentState();
  const { isLoading, startLoading, stopLoading } = useLoadingState();

  const [isClient, setIsClient] = useState(false);
  const [formattedSSML, setFormattedSSML] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Load demo data on mount
  useEffect(() => {
    async function loadDemoData() {
      try {
        // Start loading state
        startLoading('Loading demo data...');
        
        // Read demo data
        const demoData = await readAssessmentDemoData(DEMO_ID);
        
        if (demoData) {
          // Update assessment data
          updateAssessmentData(demoData.assessmentData);
          
          // Store compressed entries and treatments in localStorage like handleSubmit did
          const entriesStorageKey = `goodnumbers-nightscout-entries-${DEMO_ID}`;
          localStorage.setItem(
            entriesStorageKey,
            JSON.stringify({
              entries: demoData.nightscoutData.entries,
              timestamp: demoData.timestamp,
            }),
          );
          
          const treatmentsStorageKey = `goodnumbers-nightscout-treatments-${DEMO_ID}`;
          localStorage.setItem(
            treatmentsStorageKey,
            JSON.stringify({
              treatments: demoData.nightscoutData.treatments,
              timestamp: demoData.timestamp,
            }),
          );
        } else {
          setLoadingError(`Demo data not found for ID: ${DEMO_ID}`);
        }
      } catch (error) {
        console.error('Error loading demo data:', error);
        setLoadingError('Failed to load demo data');
      } finally {
        stopLoading();
      }
    }
    
    loadDemoData();
  }, []); // Empty dependency array - only runs on mount

  // Debug assessment data at component level
  useEffect(() => {
    if (debugMode && assessmentData) {
      console.log('Nightscout demo component assessment data:', {
        hasAssessmentData: Boolean(assessmentData),
        hasDialog: Boolean(assessmentData?.ssml_dialog),
        dialogLength: assessmentData?.ssml_dialog?.length || 0,
        hasReportItems: Boolean(assessmentData?.report_items),
        reportItemsCount: assessmentData?.report_items?.length || 0,
        hasChartData: Boolean(assessmentData?.report_items?.[0]?.data),
        chartDataPointsCount: assessmentData?.report_items?.[0]?.data?.length || 0,
      });
    }
  }, [assessmentData, debugMode]);

  // Monitor URL for debug parameter changes
  useEffect(() => {
    // Initial check for debug mode
    const isDebug = isDebugMode();
    setDebugMode(isDebug);

    // Function to handle URL changes
    const handleUrlChange = () => {
      setDebugMode(isDebugMode());
    };

    // Add popstate event listener to detect URL changes
    window.addEventListener('popstate', handleUrlChange);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Client-side initialization
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle formatting in useEffect
  useEffect(() => {
    if (debugMode) {
      console.log(
        'SSML dialog in Nightscout demo component:',
        assessmentData?.ssml_dialog ? `Present (length: ${assessmentData.ssml_dialog.length})` : 'Not present',
      );
    }

    try {
      prettier
        .format(assessmentData?.ssml_dialog || '', {
          parser: 'xml',
          plugins: [parserXml],
          xmlWhitespaceSensitivity: 'ignore',
        })
        .then((formatted) => {
          if (debugMode) {
            console.log('SSML formatted successfully, length:', formatted.length);
          }
          setFormattedSSML(formatted);
        })
        .catch((e) => {
          if (debugMode) {
            console.error('Error formatting SSML:', e);
          }
          setFormattedSSML(assessmentData?.ssml_dialog || '');
        });
    } catch (e) {
      if (debugMode) {
        console.error('Exception in SSML formatting:', e);
      }
      setFormattedSSML(assessmentData?.ssml_dialog || '');
    }
  }, [assessmentData?.ssml_dialog, debugMode]);

  // Helper function to get meanTime from a cluster
  const getClusterMeanTime = (reportItem: any): number => {
    try {
      if (reportItem.data && reportItem.data.length > 0) {
        const dataItem = reportItem.data[0];

        // Handle compressed cluster format
        if ('compressedCluster' in dataItem) {
          // First try to use the separately stored meanTimeMinutes
          if ('meanTimeMinutes' in dataItem) {
            return dataItem.meanTimeMinutes;
          }
          // Fall back to original method if not available (for backward compatibility)
          return dataItem.meanTime || 0;
        }
        // Handle legacy direct cluster format
        else if ('meanTime' in dataItem) {
          return dataItem.meanTime;
        }
      }
      return 0; // Default value if meanTime can't be determined
    } catch (e) {
      console.error('Error extracting cluster meanTime:', e);
      return 0;
    }
  };

  // Simplified render method for assessments
  const renderAssessmentContent = () => {
    if (debugMode) {
      console.log('Rendering assessment content', {
        hasSsmlDialog: Boolean(assessmentData?.ssml_dialog),
        ssmlDialogLength: assessmentData?.ssml_dialog?.length || 0,
        hasFormattedSSML: Boolean(formattedSSML),
        formattedSSMLLength: formattedSSML?.length || 0,
        hasReportItems: Boolean(assessmentData?.report_items),
        reportItemsCount: assessmentData?.report_items?.length || 0,
        hasChartData: Boolean(assessmentData?.report_items?.[0]?.data),
        chartDataPointsCount: assessmentData?.report_items?.[0]?.data?.length || 0,
      });
    }

    return (
      <Tabs defaultIndex={4}>
        <TabList>
          <Tab>Notes</Tab>
          <Tab>Assessment 1</Tab>
          <Tab>Assessment 2</Tab>
          <Tab>Dialog</Tab>
          <Tab>Report</Tab>
        </TabList>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Notes</h2>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{assessmentData?.notes || ''}</ReactMarkdown>
          </div>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 1</h2>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{assessmentData?.assessment1 || ''}</ReactMarkdown>
          </div>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 2</h2>
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{assessmentData?.assessment2 || ''}</ReactMarkdown>
          </div>
        </TabPanel>
        <TabPanel>
          {/* StatusBadge will show processing state or error, and disappear when done */}
          {assessmentData?.podcastResult?.status && <PodcastStatusBadge status={assessmentData.podcastResult.status} />}

          {/* Audio player only shows when processing is complete and URL exists */}
          {assessmentData?.podcastResult?.status === 'done' && getCurrentPodcastResult()?.url && (
            <>
              <h2 className="text-xl font-bold mb-2">Podcast</h2>
              <LazyAudioPlayer audioUrl={getCurrentPodcastResult()?.url!} />

              <div className="my-4">
                <h2 className="text-xl font-bold mb-2">Transcript</h2>
                <div className="prose dark:prose-invert max-w-none">
                  {assessmentData?.ssml_dialog ? (
                    <ReactMarkdown>{ssmlToMarkdown(assessmentData.ssml_dialog)}</ReactMarkdown>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                      <p className="font-medium">No transcript available</p>
                      <p className="text-sm mt-1">The SSML dialog data may not have been properly saved.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Debug viewer if needed */}
          {debugMode && assessmentData?.podcastResult?.status && assessmentData.podcastResult && (
            <DebugInterfaceViewer data={assessmentData.podcastResult} />
          )}
        </TabPanel>
        <TabPanel>
          {assessmentData?.podcastResult?.status && <PodcastStatusBadge status={assessmentData.podcastResult.status} />}
          {assessmentData?.report_items && assessmentData.report_items.length > 0 ? (
            <div className="mt-4">
              {assessmentData?.podcastResult?.status === 'done' && getCurrentPodcastResult()?.url && (
                <>
                  <LazyAudioPlayer audioUrl={getCurrentPodcastResult()?.url!} />
                </>
              )}

              {(() => {
                // Group reports by type
                const agpReports: any[] = [];
                const clusterReports: any[] = [];

                // Group items by their explicit ReportType enum value
                assessmentData.report_items.forEach((reportItem, index) => {
                  if (reportItem.type === ReportType.CLUSTER_LINE) {
                    clusterReports.push({ ...reportItem, originalIndex: index });
                  } else {
                    // All non-cluster reports (AGP and any future types) go here
                    agpReports.push({ ...reportItem, originalIndex: index });
                  }
                });

                // Sort cluster reports by meanTime
                const sortedClusterReports = [...clusterReports].sort((a, b) => {
                  const timeA = getClusterMeanTime(a);
                  const timeB = getClusterMeanTime(b);
                  return timeA - timeB;
                });

                if (debugMode) {
                  console.log('Report sorting info:', {
                    totalReportItems: assessmentData.report_items.length,
                    agpReportsCount: agpReports.length,
                    clusterReportsCount: clusterReports.length,
                    sortedClusterTimes: sortedClusterReports.map((cluster) => {
                      const time = getClusterMeanTime(cluster);
                      // Convert minutes to HH:MM format for easier debugging
                      const hours = Math.floor(time / 60)
                        .toString()
                        .padStart(2, '0');
                      const minutes = (time % 60).toString().padStart(2, '0');
                      return `${hours}:${minutes} (${time} min)`;
                    }),
                    // Also log raw data about each cluster for debugging
                    clusterDetails: sortedClusterReports.map((cluster) => {
                      const dataItem = cluster.data && cluster.data.length > 0 ? cluster.data[0] : null;
                      return {
                        hasMeanTimeMinutes: dataItem ? 'meanTimeMinutes' in dataItem : false,
                        meanTimeMinutesValue:
                          dataItem && 'meanTimeMinutes' in dataItem ? dataItem.meanTimeMinutes : 'N/A',
                        hasMeanTime: dataItem ? 'meanTime' in dataItem : false,
                        meanTimeValue: dataItem && 'meanTime' in dataItem ? dataItem.meanTime : 'N/A',
                        extractedTime: getClusterMeanTime(cluster),
                      };
                    }),
                  });
                }

                // Render AGP reports first (maintain original order for them)
                const renderedItems = agpReports.map((reportItem: any) => {
                  const index = reportItem.originalIndex;
                  // Create a clean copy without our temporary property
                  const cleanReportItem = { ...reportItem };
                  delete cleanReportItem.originalIndex;

                  return (
                    <ReportItemDisplay
                      key={`report-item-${index}`}
                      reportItem={cleanReportItem}
                      units={assessmentData.preferred_units || 'mg/dl'}
                      patientLowGoal={assessmentData.patient_range?.target_low}
                      patientHighGoal={assessmentData.patient_range?.target_high}
                      title={index === 0 ? 'Weekly Overview' : `Chart ${index + 1}`}
                    />
                  );
                });

                // Then render sorted cluster reports
                sortedClusterReports.forEach((reportItem, i) => {
                  const originalIndex = reportItem.originalIndex;
                  // Create a clean copy without our temporary property
                  const cleanReportItem = { ...reportItem };
                  delete cleanReportItem.originalIndex;

                  renderedItems.push(
                    <ClusterReportRenderer
                      key={`cluster-report-${originalIndex}`}
                      reportItem={cleanReportItem}
                      units={assessmentData.preferred_units || 'mg/dl'}
                      patientLowGoal={assessmentData.patient_range?.target_low}
                      patientHighGoal={assessmentData.patient_range?.target_high}
                    />,
                  );
                });

                return renderedItems;
              })()}
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
              <p className="font-medium">No chart data available</p>
              <p className="text-sm mt-1">The chart data may not have been properly saved or is missing.</p>
            </div>
          )}
          {debugMode && assessmentData && <DebugInterfaceViewer data={assessmentData} />}
          {/* Add raw data visualization for debugging */}
          {debugMode && (
            <div className="mt-6">
              {/* Debug information for chart data */}
              <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                <div>
                  Report Item count:{' '}
                  {assessmentData?.report_items ? `${assessmentData.report_items.length} items` : 'None'}
                </div>
                <div>Report Items: {JSON.stringify(assessmentData?.report_items)}</div>
                <div>
                  Chart Data Points:{' '}
                  {assessmentData?.report_items?.[0]?.data
                    ? `${assessmentData.report_items[0].data.length} points`
                    : 'None'}
                </div>
                <div>Preferred Units: {assessmentData?.preferred_units || 'Not set'}</div>
              </div>

              <details className="border rounded-md p-2 bg-gray-50 dark:bg-gray-800">
                <summary className="font-medium cursor-pointer">Show Raw Chart Data (Debug)</summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-md overflow-auto max-h-96 text-xs">
                  {assessmentData?.report_items && assessmentData.report_items.length > 0
                    ? JSON.stringify(assessmentData.report_items[0], null, 2).substring(0, 1000) + '...'
                    : 'No chart data available'}
                </pre>
              </details>
            </div>
          )}
          {/* Debug viewer if needed */}
          {debugMode && assessmentData?.podcastResult?.status && assessmentData.podcastResult && (
            <DebugInterfaceViewer data={assessmentData.podcastResult} />
          )}
        </TabPanel>
      </Tabs>
    );
  };

  return (
    <WidgetWrapper id={id || ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}

      {/* Debug mode indicator */}
      {debugMode && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 mb-4 text-sm">
          Debug Mode Active
        </div>
      )}

      {storageError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading saved data: {storageError}
        </div>
      )}

      {loadingError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {loadingError}
        </div>
      )}

      {isClient && assessmentData && (
        <div className="mt-8 max-w-4xl mx-auto">
          <div className={`transition-opacity duration-600 ease-in-out ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            {!isLoading && (
              <>
                {assessmentData.timestamp && (
                  <div className="mb-4 text-gray-600 text-center">
                    Last results generated on {assessmentData.timestamp}
                  </div>
                )}
                {renderAssessmentContent()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Optional loading message */}
      {isClient && isLoading && (
        <div
          className={`mt-8 text-center text-gray-600 transition-opacity duration-600 ease-in-out ${
            isLoading ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Loading demo data...
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutDemo;