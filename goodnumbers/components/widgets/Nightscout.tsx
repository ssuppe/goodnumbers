'use client';

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../atoms/progress';
import Cookies from 'js-cookie';
import { compress } from 'compress-json';
import { createApiClient } from '@/lib/axios/axios';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useLoadingState } from '@/hooks/useLoadingState';
import { AssessmentData, GlucoseUnits, NightscoutData, PodcastGenerateResult } from '@/types/nightscout';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import ReactMarkdown from 'react-markdown';
import * as prettier from 'prettier/standalone';
import parserXml from '@prettier/plugin-xml';
import { generateAssessments } from '@/actions/podcastActions';
import { fetchNightscoutData } from '@/actions/nightscoutActions';
import { ssmlToMarkdown } from '@/utils/ssml-client';
import { checkPodcastStatus } from '@/actions/gemini/geminiActions';
import PodcastStatusBadge from './PodcastStatusBadge';
import { AgpChart } from '../charts/AgpChart';
import Headline from '../atoms/Headline';
import WidgetWrapper from '../atoms/WidgetWrapper';
import { getCookieC, setCookieC } from '@/utils/cookies';

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
  // State management
  const { assessmentData, error: cookieError, updateAssessmentData, getCurrentPodcastResult } = useAssessmentState();
  const { isLoading, progress, progressText, error, startLoading, updateProgress, stopLoading, setLoadingError } =
    useLoadingState();
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

  interface FormDataState {
    nightscout_url: string;
    nightscout_token: string;
    preferred_units: GlucoseUnits; // Union type for strict type checking
    terms_accepted: boolean;
    responsibility_accepted: boolean;
  }

  // Form state
  const [formData, setFormData] = useState<FormDataState>({
    nightscout_url: '',
    nightscout_token: '',
    preferred_units: 'mg/dl',
    terms_accepted: false,
    responsibility_accepted: false,
  });

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

  // Load saved data on mount
  useEffect(() => {
    setIsClient(true);
    setFormData((prev) => ({
      ...prev,
      nightscout_url: getCookieC<string>('url') || '',
      nightscout_token: getCookieC<string>('token') || '',
      preferred_units: getCookieC<GlucoseUnits>('units') || 'mg/dl',
    }));
  }, [debugMode]);

  // Poll for podcast status
  useEffect(() => {
    if (!assessmentData) return; // Add early return

    const currentResult = getCurrentPodcastResult();

    if (currentResult?.status !== 'processing') return;

    const intervalId = setInterval(async () => {
      const podcastResult = getCurrentPodcastResult();

      if (!podcastResult || podcastResult.status !== 'processing') {
        clearInterval(intervalId);
        return;
      }

      // if (podcastResult.operation_id != null) {
      var response: PodcastGenerateResult = await checkPodcastStatus(podcastResult);

      const updatedData = {
        ...assessmentData,
        podcastResult: response,
        preferred_units: assessmentData.preferred_units, // Explicitly include this
      };
      updateAssessmentData(updatedData);
    }, 30000);

    return () => clearInterval(intervalId);
    // }
  }, [assessmentData, getCurrentPodcastResult, updateAssessmentData]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const name = target.name;
    const value = target.value;

    if (target.type === 'checkbox') {
      // This is an input element with a checkbox
      setFormData((prev) => ({ ...prev, [name]: target.checked }));
    } else {
      // This is a select element or non-checkbox input
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // debugger;
    if (debugMode) {
      console.log('Form submission started');
    }
    setCookieC<string>('url', formData.nightscout_url);
    setCookieC<string>('token', formData.nightscout_token);
    setCookieC<GlucoseUnits>('units', formData.preferred_units); // Add this line

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

        // Server action call wrapped in regular Promise
        return createHash(formData.nightscout_url, formData.nightscout_token).then((hash) => {
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

        // Use the sync version for setting assessment data
        updateAssessmentData(dataWithTimestamp);
        // Object.entries(dataWithTimestamp).forEach(([key, value]) => {
        //   setCookieCSync(key, value, { expires: 30 });
        // });

        // Set a new state to indicate successful submission
        setFormSubmitted(true); // Add this state

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
          <h2 className="text-xl font-bold mb-2">Charts</h2>
          {assessmentData?.podcastResult?.status && <PodcastStatusBadge status={assessmentData.podcastResult.status} />}

          {assessmentData?.report_items &&
          assessmentData.report_items.length > 0 &&
          assessmentData.report_items[0]?.data &&
          assessmentData.report_items[0].data.length > 0 ? (
            <div className="mt-4" key={'chart-0'}>
              <AgpChart
                data={assessmentData.report_items[0].data}
                units={assessmentData.preferred_units || 'mg/dl'}
                // patientLowGoal={assessmentData.patient_range.target_low}
                // patientHighGoal={assessmentData.patient_range.target_high}
              />
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
              <p className="font-medium">No chart data available</p>
              <p className="text-sm mt-1">The chart data may not have been properly saved or is missing.</p>
            </div>
          )}

          {/* Add raw data visualization for debugging */}
          {debugMode && (
            <div className="mt-6">
              {/* Debug information for chart data */}
              <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                <div>
                  Report Items: {assessmentData?.report_items ? `${assessmentData.report_items.length} items` : 'None'}
                </div>
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

      {cookieError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          Error loading saved data: {cookieError}
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
                    <option value="mmol/l">mmol/L</option>
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
                  Create podcast
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
