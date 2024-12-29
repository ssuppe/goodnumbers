'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../ui/progress';
import Cookies from 'js-cookie';

import { generateAssessments } from './nightscoutActions';
import { compress } from 'compress-json';
import { createApiClient } from '~/lib/api/axios';
import { useAssessmentState } from '~/hooks/useAssessmentState';
import { useLoadingState } from '~/hooks/useLoadingState';
import { AssessmentData, PodcastGenerateResult } from '~/types/nightscout';
import 'react-h5-audio-player/lib/styles.css';
import LazyAudioPlayer from './LazyAudioPlayer';
import { config } from 'src/utils/env';
import DebugInterfaceViewer from './DebugInterfaceViewer';

interface NightscoutComponentProps extends NightscoutProps {
  onAssessmentComplete?: (data: AssessmentData) => void;
  local?: string | null;
}

let axiosInstance = createApiClient();

const NightscoutComponent = ({
  header,
  id,
  hasBackground = false,
  onAssessmentComplete,
}: NightscoutComponentProps): JSX.Element => {
  const { assessmentData, error: cookieError, updateAssessmentData, getCurrentPodcastResult } = useAssessmentState();

  const { isLoading, progress, progressText, error, startLoading, updateProgress, stopLoading, setLoadingError } =
    useLoadingState();

  const [isClient, setIsClient] = useState(false);
  // Add useEffect to set isClient
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    console.log('Backend URL:', config.backendUrl);
  }, []);

  // Simplified form data
  const [formData, setFormData] = useState({
    nightscout_url: Cookies.get('url') || '',
    nightscout_token: Cookies.get('token') || '',
    terms_accepted: false,
    demo_data: false,
  });

  // Effect for polling podcast status
  const updatePodcastResult = useCallback(
    async (podcastResult: PodcastGenerateResult | null) => {
      try {
        // Update the entire podcast result in cookies and state
        if (assessmentData) {
          const updatedAssessmentData = {
            ...assessmentData,
            podcastResult: podcastResult,
          };
          await updateAssessmentData(updatedAssessmentData);
        }

        return podcastResult?.status;
      } catch (error) {
        console.error('Error checking podcast status:', error);
        return 'error';
      }
    },
    [assessmentData, updateAssessmentData],
  );

  useEffect(() => {
    // Only set up polling if status is processing
    const currentResult = getCurrentPodcastResult();
    if (currentResult?.status !== 'processing') {
      return;
    }

    async function checkStatus() {
      try {
        let currentPodcastResult = getCurrentPodcastResult();
        console.error(currentPodcastResult);
        if (currentPodcastResult == null || currentPodcastResult.status == 'processing') {
          const response = await axiosInstance.post(config.backendUrl + '/api/check_podcast', currentPodcastResult);
          await updatePodcastResult(response.data);

          // If done or error, clear the interval
          if (response.data.status === 'done' || response.data.status === 'error') {
            clearInterval(intervalId);
          }
        }
      } catch (error) {
        console.error('Error checking podcast status:', error);
        clearInterval(intervalId);
      }
    }

    // Poll immediately
    // checkStatus();
    // Then every 30 seconds
    const intervalId = setInterval(checkStatus, 30000);

    // Cleanup on unmount
    // return () => {
    //   if (intervalId) {
    //     clearInterval(intervalId);
    //   }
    // };
  }, [updateAssessmentData]);

  // Simplified handleSubmit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startLoading('Collecting Nightscout data...');

    try {
      // Save form data to cookies
      Cookies.set('url', formData.nightscout_url, { expires: 30 });
      Cookies.set('token', formData.nightscout_token, { expires: 30 });

      updateProgress(25, 'Collecting Nightscout data...');

      // Get Nightscout data
      const nightscoutData = await fetchNightscoutData(formData.nightscout_url, formData.nightscout_token);

      // Generate assessments
      updateProgress(50, 'Generating podcast...');

      const compressedData = {
        entries: compress(nightscoutData.entries),
        treatments: compress(nightscoutData.treatments),
      };

      const data = await generateAssessments(
        compressedData?.entries,
        compressedData?.treatments || null,
        formData.demo_data,
      );

      // Add timestamp to data
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

      // Update all assessment data at once
      await updateAssessmentData(dataWithTimestamp);

      if (onAssessmentComplete) {
        onAssessmentComplete(dataWithTimestamp);
      }
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      stopLoading();
    }
  };

  const isFormValid = formData.nightscout_url && formData.nightscout_token && formData.terms_accepted;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  const fetchNightscoutData = async (nightscout_url: string, nightscout_token: string) => {
    const today = new Date();
    const daysAgo = new Date(today.setDate(today.getDate() - 9));
    const daysAgoTimestamp = daysAgo.getTime();

    // const entriesUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[created_at][$gte]=${daysAgoStr}&count=20000`;
    const entriesUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${daysAgoTimestamp}&count=20000`;

    // const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${daysAgoTimestamp}&count=20000`;
    // treatments API only supports created_at
    const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${daysAgoTimestamp}&count=10000`;

    try {
      const [entriesResponse, treatmentsResponse] = await Promise.all([
        axiosInstance.get(entriesUrl),
        axiosInstance.get(treatmentsUrl),
      ]);

      let entriesData = entriesResponse.data.filter((item: { date: number }) => item.date >= daysAgoTimestamp);
      entriesData = entriesData.map((item: { date: number; sgv: number; units: string; utcOffset: number }) => ({
        date: item.date,
        sgv: item.sgv,
        units: item.units,
        utcOffset: item.utcOffset,
      }));
      let treatmentsData = treatmentsResponse.data.filter(
        (item: { date: number; eventType: string; carbs?: number; insulin?: number }) => {
          return item.date >= daysAgoTimestamp && (item.carbs !== null || item.insulin !== null);
        },
      );
      treatmentsData = treatmentsData.map(
        (item: { date: number; carbs?: number; utcOffset: number; insulin?: number; eventType: string }) => ({
          date: item.date,
          carbs: item.carbs,
          insulin: item.insulin,
          utcOffset: item.utcOffset,
          eventType: item.eventType,
        }),
      );
      return { entries: entriesData, treatments: treatmentsData };
    } catch (error) {
      throw new Error('Failed to fetch Nightscout data');
    }
  };

  // Simplified render method for assessments
  const renderAssessmentContent = () => {
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
          <pre className="whitespace-pre-wrap">{assessmentData?.notes}</pre>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 1</h2>
          <pre className="whitespace-pre-wrap">{assessmentData?.assessment1}</pre>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 2</h2>
          <pre className="whitespace-pre-wrap">{assessmentData?.assessment2}</pre>
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
          <pre className="whitespace-pre-wrap">{assessmentData?.dialog}</pre>
        </TabPanel>
      </Tabs>
    );
  };

  const renderDebugViewer = () => {
    const viewerData = assessmentData?.podcastResult;
    if (!viewerData) return null;

    return (
      <div className="p-4">
        <DebugInterfaceViewer data={viewerData} />
      </div>
    );
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
            {isLoading ? 'Creating...' : 'Create'}
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
