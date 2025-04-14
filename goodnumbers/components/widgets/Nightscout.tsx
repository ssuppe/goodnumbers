'use client';

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../atoms/progress';
import { compress, decompress } from 'compress-json';
import { createApiClient } from '@/lib/axios/axios';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useLoadingState } from '@/hooks/useLoadingState';
import { useFormState } from '@/hooks/useFormState';
import { AssessmentData, GlucoseUnits, NightscoutData, PodcastGenerateResult, ReportType } from '@/types/nightscout.d';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import ReactMarkdown from 'react-markdown';
import * as prettier from 'prettier/standalone';
import parserXml from '@prettier/plugin-xml';
import { generateAssessments } from '@/actions/podcastActions';
import { fetchNightscoutData } from '@/actions/nightscoutActions';
import { ssmlToMarkdown } from '@/utils/ssml-client';
import PodcastStatusBadge from './PodcastStatusBadge';
import { ReportItemDisplay } from '../charts/AgpReportItemDisplay';
import { ClusterReportRenderer } from '../report/ClusterReportRenderer';
import Headline from '../atoms/Headline';
import WidgetWrapper from '../atoms/WidgetWrapper';
import { checkPodcastStatus } from '@/actions/gemini/services/podcastService';

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

interface NightscoutComponentProps extends NightscoutWidgetProps {
  onAssessmentComplete?: (data: AssessmentData) => void;
}

function createHash(url: string, token: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const combined = `${url}:${token}`;
  const data = textEncoder.encode(combined);

  return crypto.subtle.digest('SHA-256', data).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  });
}

const axiosInstance = createApiClient();

const NightscoutComponent = ({
  header,
  id,
  hasBackground = false,
  onAssessmentComplete,
}: NightscoutComponentProps): JSX.Element => {
  // State management with our new hooks
  const { assessmentData, error: storageError, updateAssessmentData, getCurrentPodcastResult } = useAssessmentState();
  const { isLoading, progress, progressText, error, startLoading, updateProgress, stopLoading, setLoadingError } =
    useLoadingState();
  const { formData, handleInputChange, error: formError } = useFormState();

  const [isClient, setIsClient] = useState(false);
  const [formattedSSML, setFormattedSSML] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Debug assessment data at component level
  useEffect(() => {
    if (debugMode && assessmentData) {
      console.log('Nightscout component assessment data:', {
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

  // Poll for podcast status
  useEffect(() => {
    if (!assessmentData) return;

    const currentResult = getCurrentPodcastResult();

    if (currentResult?.status !== 'processing') return;

    const intervalId = setInterval(async () => {
      const podcastResult = getCurrentPodcastResult();

      if (!podcastResult || podcastResult.status !== 'processing') {
        clearInterval(intervalId);
        return;
      }

      const response: PodcastGenerateResult = await checkPodcastStatus(podcastResult);

      const updatedData = {
        ...assessmentData,
        podcastResult: response,
        preferred_units: assessmentData.preferred_units, // Explicitly include this
      };
      updateAssessmentData(updatedData);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [assessmentData, getCurrentPodcastResult, updateAssessmentData]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (debugMode) {
      console.log('Form submission started');
    }

    e.preventDefault();
    startLoading('Collecting Nightscout data...');

    // First handle the Nightscout data fetch
    updateProgress(25, 'Collecting Nightscout data...');
    fetchNightscoutData({ url: formData.nightscout_url, token: formData.nightscout_token })
      .then((nightscoutData: NightscoutData) => {
        if (debugMode) {
          debugger; // Only trigger debugger in debug mode
        }
        updateProgress(
          50,
          "Generating assessments (this will take a few minutes). Please don't close your browser. After, we will generate the audio of the podcast.",
        );
        const compressedData = {
          entries: compress(nightscoutData.entries),
          treatments: compress(nightscoutData.treatments),
          profiles: compress(nightscoutData.profiles),
        };

        // Store the compressed entries in localStorage for future reference by cluster visualization
        return createHash(formData.nightscout_url, formData.nightscout_token).then((hash) => {
          // Save entries data separately with the hash as reference
          const entriesStorageKey = `goodnumbers-nightscout-entries-${hash}`;
          localStorage.setItem(
            entriesStorageKey,
            JSON.stringify({
              entries: compressedData.entries,
              timestamp: new Date().toISOString(),
            }),
          );

          return generateAssessments(
            compressedData?.entries,
            compressedData?.treatments || null,
            compressedData.profiles,
            hash,
            formData.preferred_units, // Add units preference
          );
        });
      })
      .then((data) => {
        const now = new Date();
        const formattedTimestamp = now
          .toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          .replace(/\//g, '-');
        if (data == null) return;
        const dataWithTimestamp = {
          ...data,
          timestamp: formattedTimestamp,
          preferred_units: data.preferred_units, // Explicitly include this
        };

        // Update assessment data (which will save to localStorage)
        updateAssessmentData(dataWithTimestamp);

        // Set a new state to indicate successful submission
        setFormSubmitted(true);

        if (onAssessmentComplete) {
          onAssessmentComplete(dataWithTimestamp);
        }
      })
      .catch((error) => {
        setLoadingError(error instanceof Error ? error.message : 'An unexpected error occurred');
      })
      .finally(() => {
        stopLoading();
      });
  };

  const isFormValid =
    formData.nightscout_url && formData.nightscout_token && formData.terms_accepted && formData.responsibility_accepted;

  // Handle formatting in useEffect
  useEffect(() => {
    if (debugMode) {
      console.log(
        'SSML dialog in Nightscout component:',
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
          // Try to extract meanTime from compressed data
          // Since we can't directly decompress here, we'll use a fallback
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
                // Group reports by
                debugger;
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
                    sortedClusterTimes: sortedClusterReports.map((cluster) => getClusterMeanTime(cluster)),
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

  const renderDebugViewer = () => {
    if (!debugMode) return null;

    const viewerData = assessmentData?.podcastResult;
    if (!viewerData) return null;

    return <DebugInterfaceViewer data={viewerData} />;
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

      {formError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading form data: {formError}
        </div>
      )}

      {!formSubmitted && (
        <div className="flex items-stretch justify-center">
          <form onSubmit={handleSubmit} className="card h-fit max-w-2xl mx-auto p-5 md:p-12">
            {isLoading && (
              <div className="mb-4">
                <Progress value={progress} className="w-full" />
                <p className="text-center mt-2 text-gray-700 dark:text-slate-200">{progressText}</p>
              </div>
            )}
            {error && (
              <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            {/* Form fields - only shown when NOT loading */}
            {!isLoading && (
              <>
                {/* Nightscout URL input */}
                <input
                  type="text"
                  name="nightscout_url"
                  placeholder="Nightscout URL"
                  value={formData.nightscout_url}
                  onChange={handleInputChange}
                  className="w-full p-2 mb-4 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  name="nightscout_token"
                  placeholder="Nightscout Token"
                  value={formData.nightscout_token}
                  onChange={handleInputChange}
                  className="w-full p-2 mb-4 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <div className="w-full mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Preferred glucose units
                  </label>
                  <select
                    name="preferred_units"
                    value={formData.preferred_units}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  >
                    <option value="mg/dl">mg/dL</option>
                    <option value="mmol/L">mmol/L</option>
                  </select>
                </div>
                <label className="flex items-start mb-4 text-gray-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    name="terms_accepted"
                    checked={formData.terms_accepted}
                    onChange={handleInputChange}
                    className="mr-2 mt-1"
                  />
                  <span>
                    I understand this is experimental. The analysis might be wrong and does not constitute medical
                    advice. All data should be manually verified by you and your healthcare professionals.
                  </span>
                </label>
                <label className="flex items-start mb-4 text-gray-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    name="responsibility_accepted"
                    checked={formData.responsibility_accepted}
                    onChange={handleInputChange}
                    className="mr-2 mt-1"
                  />
                  <span>
                    I am consenting to sending this data, and understand I do not have to if I do not want to. I take
                    full responsibility for the sending of this data, as well as what I do with the information that is
                    given to me.
                  </span>
                </label>
                {/* Submit button - only shown when not loading */}
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`w-full p-2 text-white rounded ${
                    isFormValid
                      ? 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  Create weekly report
                </button>
              </>
            )}
          </form>
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
          Your results will appear here when we are done
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutComponent;
