'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Progress from '../ui/progress';
import Cookies from 'js-cookie';

import { generateAssessments, PodcastGenerateResult } from './nightscoutActions';
import { compress } from 'compress-json';
import { setCookieC, getCookieC } from '~/utils/cookies';
import DebugInterfaceViewer from './DebugInterfaceViewer';
import { createApiClient } from '~/lib/api/axios';

interface AssessmentData {
  notes: string;
  assessment1: string;
  assessment2: string;
  dialog: string;
  podcast_result: PodcastGenerateResult;
}

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
  const [assessmentData, setAssessmentData] = useState<{
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
    podcast_result: PodcastGenerateResult;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [podcastStatus, setPodcastStatus] = useState<string | null>(null);
  const [shouldCheckStatus, setShouldCheckStatus] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Add state for last generated timestamp
  const storedTimestamp = getCookieC<string>('lastGeneratedTime');
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string | null>(storedTimestamp);

  // Get stored values
  const storedUrl = Cookies.get('url');
  const storedToken = Cookies.get('token');
  const storedNotes = getCookieC<string>('notes');
  const storedAssessment1 = getCookieC<string>('assessment1');
  const storedAssessment2 = getCookieC<string>('assessment2');
  const storedDialog = getCookieC<string>('dialog');
  const storedPodcastResult: PodcastGenerateResult | null = getCookieC<string>('podcast_result')
    ? getCookieC('podcast_result')
    : null;

  // Initialize debugPodcastResult with proper error handling
  const [debugPodcastResult, setDebugPodcastResult] = useState<PodcastGenerateResult | null>(() => {
    try {
      return storedPodcastResult ? storedPodcastResult : null;
    } catch (e) {
      console.error('Error parsing stored podcast result:', e);
      return null;
    }
  });

  const [formData, setFormData] = useState({
    nightscout_url: storedUrl || '',
    nightscout_token: storedToken || '',
    terms_accepted: false,
    demo_data: false,
    storedNotes: storedNotes,
    storedAssessment1: storedAssessment1,
    storedAssessment2: storedAssessment2,
    storedDialog: storedDialog,
    storedPodcastResult: storedPodcastResult,
  });

  useEffect(() => {
    return () => {
      setShouldCheckStatus(false);
      setDebugPodcastResult(null);
      setPodcastStatus(null);
    };
  }, []);

  // Combined effect for podcast result updates
  useEffect(() => {
    const newPodcastResult = assessmentData?.podcast_result || storedPodcastResult;
    if (newPodcastResult && JSON.stringify(newPodcastResult) !== JSON.stringify(debugPodcastResult)) {
      setDebugPodcastResult(newPodcastResult);
    }
  }, [assessmentData, storedPodcastResult, debugPodcastResult]);

  // Effect to check stored podcast result on mount
  useEffect(() => {
    if (storedPodcastResult && storedPodcastResult.status === 'processing') {
      console.log('Found processing podcast, resuming status checks');
      setShouldCheckStatus(true);
    }
  }, []); // Empty dependency array means this runs once on mount


  // Effect for polling podcast status
  useEffect(() => {
    let intervalId;
    const activePodcastResult = assessmentData?.podcast_result || storedPodcastResult;
    
    const checkPodcastStatus = async () => {
      if (activePodcastResult && activePodcastResult.operation_id) {
        try {
          const response = await axiosInstance.post('/pyapi/check_podcast', activePodcastResult);
          const newStatus = response.data.status;
          
          setPodcastStatus(prevStatus => {
            if (prevStatus !== newStatus) {
              return newStatus;
            }
            return prevStatus;
          });
  
          setDebugPodcastResult(prev => {
            if (prev && prev.status !== newStatus) {
              return { ...prev, status: newStatus };
            }
            return prev;
          });
  
          if (newStatus === 'done' || newStatus === 'error') {
            setShouldCheckStatus(false);
          }
        } catch (error) {
          console.error('Error checking podcast status:', error);
          setShouldCheckStatus(false);
        }
      }
    };
  
    if (shouldCheckStatus && activePodcastResult) {
      checkPodcastStatus();
      intervalId = setInterval(checkPodcastStatus, 30000);
    }
  
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [shouldCheckStatus]);  // Remove assessmentData and storedPodcastResult from dependencies

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Submitted!');
    setError(null);
    Cookies.set('url', formData.nightscout_url, { expires: 30 });
    Cookies.set('token', formData.nightscout_token, { expires: 30 });
    setIsLoading(true);
    setProgress(0);

    setProgressText('Collecting Nightscout data...');
    setProgress(25);

    try {
      let sgvData = null;
      let treatmentsData = null;
      if (!formData.demo_data) {
        const nightscout_data = await fetchNightscoutData(formData.nightscout_url, formData.nightscout_token);
        sgvData = nightscout_data.sgvData;
        treatmentsData = nightscout_data.treatmentsData;
      }

      setProgressText('Generating podcast (this could take several minutes)...');
      setProgress(50);
      
      let csgvData = compress(sgvData);
      let ctreatmentsData = compress(treatmentsData);
      const data = await generateAssessments(csgvData, ctreatmentsData, formData.demo_data);
      setProgress(100);

      // Store the current timestamp
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

      await setCookieC('lastGeneratedTime', formattedTimestamp);
      setLastGeneratedTime(formattedTimestamp);

      if (data.notes) await setCookieC('notes', data.notes);
      if (data.assessment1) await setCookieC('assessment1', data.assessment1);
      if (data.assessment2) await setCookieC('assessment2', data.assessment2);
      if (data.dialog) await setCookieC('dialog', data.dialog);
      if (data.podcast_result) await setCookieC('podcast_result', JSON.stringify(data.podcast_result), { expires: 30 });

      setAssessmentData(data);
      setShouldCheckStatus(true);

      if (onAssessmentComplete) {
        onAssessmentComplete(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
      setProgress(0);
      setProgressText('');
    }
  };




  const renderDebugViewer = () => {
    const viewerData = assessmentData?.podcast_result || debugPodcastResult;
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
      {(assessmentData || storedNotes) && isClient &&(
        <div className="mt-8 max-w-4xl mx-auto">
          {lastGeneratedTime && (
            <div className="mb-4 text-gray-600 text-center">Last results generated on {lastGeneratedTime}</div>
          )}
          <Tabs>
            <TabList>
              <Tab>Notes</Tab>
              <Tab>Assessment 1</Tab>
              <Tab>Assessment 2</Tab>
              <Tab>Dialog</Tab>
            </TabList>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Notes</h2>
              <pre className="whitespace-pre-wrap">{assessmentData ? assessmentData.notes : storedNotes}</pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Assessment 1</h2>
              <pre className="whitespace-pre-wrap">
                {assessmentData ? assessmentData.assessment1 : storedAssessment1}
              </pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Assessment 2</h2>
              <pre className="whitespace-pre-wrap">
                {assessmentData ? assessmentData.assessment2 : storedAssessment2}
              </pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Dialog</h2>
              {podcastStatus && (
          <h2
            className={`text-xl font-bold mb-4 ${
              podcastStatus === 'done'
                ? 'text-green-600'
                : podcastStatus === 'error'
                  ? 'text-red-600'
                  : 'text-black'
            }`}
          >
            {podcastStatus.charAt(0).toUpperCase() + podcastStatus.slice(1)}
          </h2>
        )}

        {renderDebugViewer()}
        
        <pre className="whitespace-pre-wrap">
          {assessmentData ? assessmentData.dialog : storedDialog}
        </pre>
            </TabPanel>
          </Tabs>
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutComponent;
