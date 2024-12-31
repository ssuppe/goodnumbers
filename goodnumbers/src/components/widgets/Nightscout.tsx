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
import { AssessmentData } from '~/types/nightscout';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import { config } from 'src/utils/env';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import ReactMarkdown from 'react-markdown';
import prettier from 'prettier/standalone';
import parserXml from '@prettier/plugin-xml';
import { generateAssessments } from './nightscoutActions';
import { setCookieCSync } from '~/utils/cookies';
import ssmlToMarkdown from '~/utils/ssml';

interface NightscoutComponentProps extends NightscoutProps {
  onAssessmentComplete?: (data: AssessmentData) => void;
  local?: string | null;
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

// Separate data fetching logic into a plain function
const fetchNightscoutData = (nightscout_url: string, nightscout_token: string) => {
  const today = new Date();
  const daysAgo = new Date(today.setDate(today.getDate() - 9));
  const daysAgoTimestamp = daysAgo.getTime();

  const entriesUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${daysAgoTimestamp}&count=20000`;
  const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${daysAgoTimestamp}&count=10000`;

  return Promise.all([axiosInstance.get(entriesUrl), axiosInstance.get(treatmentsUrl)]).then(
    ([entriesResponse, treatmentsResponse]) => {
      let entriesData = entriesResponse.data
        .filter((item: { date: number }) => item.date >= daysAgoTimestamp)
        .map((item: { date: number; sgv: number; units: string; utcOffset: number }) => ({
          date: item.date,
          sgv: item.sgv,
          units: item.units,
          utcOffset: item.utcOffset,
        }));

      let treatmentsData = treatmentsResponse.data
        .filter(
          (item: { date: number; eventType: string; carbs?: number; insulin?: number }) =>
            item.date >= daysAgoTimestamp && (item.carbs !== null || item.insulin !== null),
        )
        .map((item: { date: number; carbs?: number; utcOffset: number; insulin?: number; eventType: string }) => ({
          date: item.date,
          carbs: item.carbs,
          insulin: item.insulin,
          utcOffset: item.utcOffset,
          eventType: item.eventType,
        }));

      return { entries: entriesData, treatments: treatmentsData };
    },
  );
};

const NightscoutComponent = ({
  header,
  id,
  hasBackground = false,
  onAssessmentComplete,
}: NightscoutComponentProps): JSX.Element => {
  console.log('NightscoutComponent rendering'); // Add this

  // State management
  const { assessmentData, error: cookieError, updateAssessmentData, getCurrentPodcastResult } = useAssessmentState();
  const { isLoading, progress, progressText, error, startLoading, updateProgress, stopLoading, setLoadingError } =
    useLoadingState();
  const [isClient, setIsClient] = useState(false);
  const [formattedSSML, setFormattedSSML] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    nightscout_url: '',
    nightscout_token: '',
    terms_accepted: false,
    demo_data: false,
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

    const intervalId = setInterval(() => {
      const podcastResult = getCurrentPodcastResult();

      if (!podcastResult || podcastResult.status !== 'processing') {
        clearInterval(intervalId);
        return;
      }

      // Use .then() instead of async/await
      axiosInstance
        .post(config.backendUrl + '/api/check_podcast', podcastResult)
        .then((response) => {
          if (assessmentData) {
            const updatedData = {
              ...assessmentData,
              podcastResult: response.data,
            };
            updateAssessmentData(updatedData);
          }

          if (response.data.status === 'done' || response.data.status === 'error') {
            clearInterval(intervalId);
          }
        })
        .catch((error) => {
          console.error('Error checking podcast status:', error);
          clearInterval(intervalId);
        });
    }, 30000);

    return () => clearInterval(intervalId);
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

    e.preventDefault();
    startLoading('Collecting Nightscout data...');

    // First handle the Nightscout data fetch
    updateProgress(25, 'Collecting Nightscout data...');
    fetchNightscoutData(formData.nightscout_url, formData.nightscout_token)
      .then((nightscoutData) => {
        updateProgress(50, 'Generating assessments...');
        const compressedData = {
          entries: compress(nightscoutData.entries),
          treatments: compress(nightscoutData.treatments),
        };

        // Create ID for serverside saving, podcast management, etc

        // Server action call wrapped in regular Promise
        // return generateAssessments(compressedData?.entries, compressedData?.treatments || null, formData.demo_data);
        return createHash(formData.nightscout_url, formData.nightscout_token).then((hash) => {
          return generateAssessments(compressedData?.entries, compressedData?.treatments || null, hash);
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

  const isFormValid = formData.nightscout_url && formData.nightscout_token && formData.terms_accepted;

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
    console.log('SSML' + formattedSSML); // Add this

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
          <h2 className="text-xl font-bold mb-2">Dialog</h2>
          {assessmentData?.podcastResult?.status && (
            <h2
              className={`text-xl font-bold mb-4 ${
                assessmentData?.podcastResult?.status === 'done'
                  ? 'text-green-600'
                  : assessmentData?.podcastResult?.status === 'error'
                    ? 'text-red-600'
                    : 'text-black'
              }`}
            >
              {assessmentData?.podcastResult?.status.charAt(0).toUpperCase() +
                assessmentData?.podcastResult.status.slice(1)}
            </h2>
          )}
          {assessmentData?.podcastResult?.status === 'done' && getCurrentPodcastResult()?.url && (
            <LazyAudioPlayer audioUrl={getCurrentPodcastResult()?.url!} />
          )}
          {assessmentData?.podcastResult?.status && assessmentData.podcastResult && (
            <DebugInterfaceViewer data={assessmentData.podcastResult} />
          )}
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{ssmlToMarkdown(assessmentData?.ssml_dialog || '')}</ReactMarkdown>
          </div>
          {/* <pre className="whitespace-pre-wrap">{ssmlToMarkdown(assessmentData?.dialog || '')}</pre> */}
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

      <div className="flex items-stretch justify-center">
        <form onSubmit={handleSubmit} className="card h-fit max-w-2xl mx-auto p-5 md:p-12">
          {isLoading && (
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center mt-2">{progressText}</p>
            </div>
          )}
          {error && <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
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
            I understand this is experimental and does not constitute medical advice, and is entirely my responsibility
          </label>
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`w-full p-2 text-white rounded ${
              isFormValid && !isLoading ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Creating podcast...' : 'Create podcast'}
          </button>
        </form>
      </div>
      {isClient && assessmentData && (
        <div className="mt-8 max-w-4xl mx-auto">
          {assessmentData.timestamp && (
            <div className="mb-4 text-gray-600 text-center">Last results generated on {assessmentData.timestamp}</div>
          )}
          {renderAssessmentContent()}
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutComponent;
