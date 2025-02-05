'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../ui/progress';
import Cookies from 'js-cookie';
import { compress } from 'compress-json';
import { createApiClient } from '~/lib/api/axios';
import { useAssessmentState } from '~/hooks/useAssessmentState';
import { useLoadingState } from '~/hooks/useLoadingState';
import { AssessmentData, JobCheckResponse, NightscoutData, PodcastGenerateResult } from '~/types/nightscout';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import { config } from 'src/utils/env';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import ReactMarkdown from 'react-markdown';
import prettier from 'prettier/standalone';
import parserXml from '@prettier/plugin-xml';
import { generateAssessments } from './podcastActions';
import { setCookieCSync } from '~/utils/cookies';
import { fetchNightscoutData } from './nightscoutActions';
import { ssmlToMarkdown } from '~/utils/ssml-client';
import { checkPodcastStatus } from '~/gemini/geminiActions';
import PodcastStatusBadge from './PodcastStatusBadge';

interface NightscoutComponentProps extends NightscoutProps {
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

  // Form state
  const [formData, setFormData] = useState({
    nightscout_url: '',
    nightscout_token: '',
    terms_accepted: false,
    responsibility_accepted: false,
  });

  // Load saved data on mount
  useEffect(() => {
    console.log('Load saved data on mount'); // Add this

    setIsClient(true);
    setFormData((prev) => ({
      ...prev,
      nightscout_url: Cookies.get('url') || '',
      nightscout_token: Cookies.get('token') || '',
    }));
  }, []);

  // Poll for podcast status
  useEffect(() => {
    console.log('Podcast polling effect running'); // Add this

    const currentResult = getCurrentPodcastResult();
    console.log('Current podcast result:', currentResult); // Add this

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
      };
      updateAssessmentData(updatedData);
    }, 30000);

    return () => clearInterval(intervalId);
    // }
  }, [assessmentData, getCurrentPodcastResult, updateAssessmentData]);

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    console.log('Form submission started'); // Add this
    console.log('new');
    Cookies.set('url', formData.nightscout_url);
    Cookies.set('token', formData.nightscout_token);

    e.preventDefault();
    startLoading('Collecting Nightscout data...');

    // First handle the Nightscout data fetch
    updateProgress(25, 'Collecting Nightscout data...');
    fetchNightscoutData({ url: formData.nightscout_url, token: formData.nightscout_token })
      .then((nightscoutData: NightscoutData) => {
        updateProgress(
          50,
          "Generating assessments (this will take a few minutes). Please don't close your browser. After, we will generate the audio of the podcast.",
        );
        const compressedData = {
          entries: compress(nightscoutData.entries),
          treatments: compress(nightscoutData.treatments),
          profiles: compress(nightscoutData.profiles),
        };

        // Create ID for serverside saving, podcast management, etc

        // Server action call wrapped in regular Promise
        return createHash(formData.nightscout_url, formData.nightscout_token).then((hash) => {
          return generateAssessments(
            compressedData?.entries,
            compressedData?.treatments || null,
            compressedData.profiles,
            hash,
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

        const dataWithTimestamp = {
          ...data,
          timestamp: formattedTimestamp,
        };

        // Use the sync version for setting assessment data
        updateAssessmentData(dataWithTimestamp);
        Object.entries(dataWithTimestamp).forEach(([key, value]) => {
          setCookieCSync(key, value, { expires: 30 });
        });

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
    try {
      prettier
        .format(assessmentData?.ssml_dialog || '', {
          parser: 'xml',
          plugins: [parserXml],
          xmlWhitespaceSensitivity: 'ignore',
        })
        .then((formatted) => {
          setFormattedSSML(formatted);
        })
        .catch((e) => {
          setFormattedSSML(assessmentData?.ssml_dialog || '');
        });
    } catch (e) {
      setFormattedSSML(assessmentData?.ssml_dialog || '');
    }
  }, [assessmentData?.ssml_dialog]);

  // Simplified render method for assessments
  const renderAssessmentContent = () => {
    // console.log('SSML' + formattedSSML); // Add this

    return (
      <Tabs defaultIndex={3}>
        <TabList>
          <Tab>Notes</Tab>
          <Tab>Assessment 1</Tab>
          <Tab>Assessment 2</Tab>
          <Tab>Dialog</Tab>
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
              <LazyAudioPlayer audioUrl={getCurrentPodcastResult()?.url!} />
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{ssmlToMarkdown(assessmentData?.ssml_dialog || '')}</ReactMarkdown>
              </div>
            </>
          )}

          {/* Debug viewer if needed */}
          {assessmentData?.podcastResult?.status && assessmentData.podcastResult && (
            <DebugInterfaceViewer data={assessmentData.podcastResult} />
          )}
        </TabPanel>
      </Tabs>
    );
  };

  const renderDebugViewer = () => {
    const viewerData = assessmentData?.podcastResult;
    if (!viewerData) return null;

    return <DebugInterfaceViewer data={viewerData} />;
  };

  return (
    <WidgetWrapper id={id || ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}

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
                <p className="text-center mt-2">{progressText}</p>
              </div>
            )}
            {error && <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

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
                  className="w-full p-2 mb-4 border rounded"
                />
                <input
                  type="text"
                  name="nightscout_token"
                  placeholder="Nightscout Token"
                  value={formData.nightscout_token}
                  onChange={handleInputChange}
                  className="w-full p-2 mb-4 border rounded"
                />
                <label className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    name="terms_accepted"
                    checked={formData.terms_accepted}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  I understand this is experimental. The analysis might be wrong and does not constitute medical advice.
                  All data should be manually verified by you and your healthcare professions.
                </label>
                <label className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    name="responsibility_accepted"
                    checked={formData.responsibility_accepted}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  I am consenting to sending this data, and understand I do not have to if I do not want to. I take full
                  responsibility for the sending of this data, as well as what I do with the information that is given
                  to me.
                </label>
                {/* Submit button - only shown when not loading */}
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`w-full p-2 text-white rounded ${
                    isFormValid ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'
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
