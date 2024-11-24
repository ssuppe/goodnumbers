'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../ui/progress';
import Cookies from 'js-cookie';

import { generateAssessments } from './nightscoutActions';
import { compress } from 'compress-json';
import { setCookieC, getCookieC } from '~/utils/cookies';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import { createApiClient } from '~/lib/api/axios';
import { useAssessmentState } from '~/hooks/useAssessmentState';
import { useLoadingState } from '~/hooks/useLoadingState';
import { AssessmentData, PodcastGenerateResult } from '~/types/nightscout';

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
  const initialStoredData = {
    notes: getCookieC<string>('notes'),
    assessment1: getCookieC<string>('assessment1'),
    assessment2: getCookieC<string>('assessment2'),
    dialog: getCookieC<string>('dialog'),
    podcastResult: getCookieC<PodcastGenerateResult>('podcast_result'),
    timestamp: getCookieC<string>('timestamp'),
  };

  const { assessmentData, updateAssessmentData, podcastStatus, setPodcastStatus, getCurrentPodcastResult } =
    useAssessmentState(initialStoredData);

  const { isLoading, progress, progressText, error, startLoading, updateProgress, stopLoading, setLoadingError } =
    useLoadingState();

  const [isClient, setIsClient] = useState(false);
  // Add useEffect to set isClient
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simplified form data
  const [formData, setFormData] = useState({
    nightscout_url: Cookies.get('url') || '',
    nightscout_token: Cookies.get('token') || '',
    terms_accepted: false,
    demo_data: false,
  });

  // Effect for polling podcast status
  // Effect for polling podcast status
  const updatePodcastResult = useCallback(
    async (podcastResult: PodcastGenerateResult | null) => {
      try {
        const response = await axiosInstance.post('/pyapi/check_podcast', podcastResult);
        const updatedPodcastResult: PodcastGenerateResult = response.data;

        // Update the podcast status
        setPodcastStatus(updatedPodcastResult.status);

        // Update the entire podcast result in cookies and state
        if (assessmentData) {
          const updatedAssessmentData = {
            ...assessmentData,
            podcast_result: updatedPodcastResult,
          };
          await updateAssessmentData(updatedAssessmentData);
        } else if (initialStoredData.notes) {
          const updatedAssessmentData: AssessmentData = {
            notes: initialStoredData.notes || '',
            assessment1: initialStoredData.assessment1 || '',
            assessment2: initialStoredData.assessment2 || '',
            dialog: initialStoredData.dialog || '',
            podcastResult: updatedPodcastResult,
            timestamp: initialStoredData.timestamp,
          };
          await updateAssessmentData(updatedAssessmentData);
        }

        return updatedPodcastResult.status;
      } catch (error) {
        console.error('Error checking podcast status:', error);
        return 'error';
      }
    },
    [assessmentData, initialStoredData, updateAssessmentData],
  );

  // Simplified useEffect with fewer dependencies
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isActive = true; // For cleanup

    const pollStatus = async () => {
      const currentPodcastResult = getCurrentPodcastResult();
      const newStatus = await updatePodcastResult(currentPodcastResult);

      if (newStatus === 'done' || newStatus === 'error') {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    const currentPodcastResult = getCurrentPodcastResult();
    if (currentPodcastResult?.status === 'processing') {
      pollStatus(); // Initial check
      intervalId = setInterval(pollStatus, 30000);
    }

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [getCurrentPodcastResult, updatePodcastResult]); // Minimal dependencies

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
    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
    const thirtyDaysAgoStr = thirtyDaysAgo
      .toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      .replace(/\//g, '-');

    const sgvUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${thirtyDaysAgoStr}&count=10000`;
    const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${thirtyDaysAgoStr}&count=20000`;

    try {
      const [sgvResponse, treatmentsResponse] = await Promise.all([
        axiosInstance.get(sgvUrl),
        axiosInstance.get(treatmentsUrl),
      ]);

      let sgvData = sgvResponse.data.filter((item: { date: string }) => new Date(item.date) >= thirtyDaysAgo);
      sgvData = sgvData.map((item: { date: number; sgv: number; units: string; utcOffset: number }) => ({
        date: item.date,
        sgv: item.sgv,
        units: item.units,
        utcOffset: item.utcOffset,
      }));
      let treatmentsData = treatmentsResponse.data.filter(
        (item: { created_at: string; eventType: string; carbs: number }) => {
          const createdAtDate = new Date(item.created_at);
          return createdAtDate >= thirtyDaysAgo && item.carbs !== null;
        },
      );
      treatmentsData = treatmentsData.map((item: { date: number; carbs: number; utcOffset: number }) => ({
        date: item.date,
        carbs: item.carbs,
        utcOffset: item.utcOffset,
      }));
      return { sgvData, treatmentsData };
    } catch (error) {
      throw new Error('Failed to fetch Nightscout data');
    }
  };

  // Simplified handleSubmit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startLoading('Collecting Nightscout data...');

    try {
      // Save form data to cookies
      Cookies.set('url', formData.nightscout_url, { expires: 30 });
      Cookies.set('token', formData.nightscout_token, { expires: 30 });

      // Get Nightscout data
      let nightscoutData = null;
      if (!formData.demo_data) {
        updateProgress(25, 'Collecting Nightscout data...');
        nightscoutData = await fetchNightscoutData(formData.nightscout_url, formData.nightscout_token);
      }

      // Generate assessments
      updateProgress(50, 'Generating podcast...');
      if (nightscoutData != null) {
        const compressedData = {
          sgvData: compress(nightscoutData.sgvData),
          treatmentsData: compress(nightscoutData.treatmentsData),
        };

        const data = await generateAssessments(
          compressedData.sgvData,
          compressedData.treatmentsData,
          formData.demo_data,
        );

        // Update all assessment data at once
        await updateAssessmentData(data);

        if (onAssessmentComplete) {
          onAssessmentComplete(data);
        }
      }
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      stopLoading();
    }
  };

  // Simplified render method for assessments
  const renderAssessmentContent = () => {
    const currentData = assessmentData || initialStoredData;

    return (
      <Tabs>
        <TabList>
          <Tab>Notes</Tab>
          <Tab>Assessment 1</Tab>
          <Tab>Assessment 2</Tab>
          <Tab>Dialog</Tab>
        </TabList>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Notes</h2>
          <pre className="whitespace-pre-wrap">{currentData.notes}</pre>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 1</h2>
          <pre className="whitespace-pre-wrap">{currentData.assessment1}</pre>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Assessment 2</h2>
          <pre className="whitespace-pre-wrap">{currentData.assessment2}</pre>
        </TabPanel>
        <TabPanel>
          <h2 className="text-xl font-bold mb-2">Dialog</h2>
          {podcastStatus && (
            <h2
              className={`text-xl font-bold mb-4 ${
                podcastStatus === 'done' ? 'text-green-600' : podcastStatus === 'error' ? 'text-red-600' : 'text-black'
              }`}
            >
              {podcastStatus.charAt(0).toUpperCase() + podcastStatus.slice(1)}
            </h2>
          )}
          {currentData.podcastResult && <DebugInterfaceViewer data={currentData.podcastResult} />}
          <pre className="whitespace-pre-wrap">{currentData.dialog}</pre>
        </TabPanel>
      </Tabs>
    );
  };

  const renderDebugViewer = () => {
    const viewerData = assessmentData?.podcastResult || debugPodcastResult;
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
            I accept the terms and conditions
          </label>
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              name="demo_data"
              checked={formData.demo_data}
              onChange={handleInputChange}
              className="mr-2"
            />
            Use demo data
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
      {isClient && (assessmentData || initialStoredData.notes) && (
        <div className="mt-8 max-w-4xl mx-auto">
          {assessmentData?.timestamp && (
            <div className="mb-4 text-gray-600 text-center">Last results generated on {assessmentData?.timestamp}</div>
          )}
          {renderAssessmentContent()}
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutComponent;
