'use client';

import React, { useState } from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { useSearchParams } from 'next/navigation';
import Progress from '../ui/progress';
import Cookies from 'js-cookie';
import axios from 'axios';
import axiosRetry from 'axios-retry';

interface ExtendedNightscoutProps extends NightscoutProps {
  onAssessmentComplete?: (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => void;
}

const Nightscout: React.FC<ExtendedNightscoutProps> = ({ header, id, hasBackground = false, onAssessmentComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const local = searchParams ? searchParams.get('local') : null;

  const storedUrl = Cookies.get('url');
  const storedToken = Cookies.get('token');

  const [formData, setFormData] = useState({
    nightscout_url: storedUrl || '',
    nightscout_token: storedToken || '',
    terms_accepted: false,
  });

  const isFormValid = formData.nightscout_url && formData.nightscout_token && formData.terms_accepted;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Create an axios instance with retry configuration
  const axiosInstance = axios.create({
    timeout: 300000, // 5 minutes
  });

  axiosRetry(axiosInstance, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout : true,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNRESET';
    },
  });

  const fetchData = async (url: string, options: any) => {
    try {
      const response = await axiosInstance({ url, ...options });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        } else if (error.response) {
          throw new Error(`Server responded with status ${error.response.status}: ${error.response.data}`);
        } else if (error.request) {
          throw new Error('No response received from the server. Please check your internet connection.');
        }
      }
      throw new Error('An unexpected error occurred. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    Cookies.set('url', formData.nightscout_url, { expires: 30 });
    Cookies.set('token', formData.nightscout_token, { expires: 30 });
    setIsLoading(true);
    setProgress(0);
    setProgressText('Fetching Nightscout data');

    try {
      for (let i = 0; i <= 25; i++) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const nightscout_token = formData.nightscout_token.replace(/^token=/, '');
      const nightscout_url = formData.nightscout_url;

      let sgvData = null;
      let treatmentsData = null;

      if (!local) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
        const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).replace(/\//g, '-');

        const sgvUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${thirtyDaysAgoStr}&count=10000`;
        const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${thirtyDaysAgoStr}&count=20000`;

        [sgvData, treatmentsData] = await Promise.all([
          fetchData(sgvUrl, { method: 'GET', headers: { accept: 'application/json' } }),
          fetchData(treatmentsUrl, { method: 'GET', headers: { accept: 'application/json' } }),
        ]);

        sgvData = sgvData.filter((item: { date: string }) => new Date(item.date) >= thirtyDaysAgo);
        treatmentsData = treatmentsData.filter((item: { created_at: string }) => new Date(item.created_at) >= thirtyDaysAgo);
      }

      setProgressText('Generating report');
      for (let i = 25; i <= 50; i++) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const getNotesResponse = await fetchData('/pyapi/get_notes', {
        method: 'POST',
        data: {
          treatments: sgvData ? JSON.stringify(sgvData) : undefined,
          carbs: treatmentsData ? JSON.stringify(treatmentsData) : undefined,
        },
      });

      const notes = getNotesResponse;

      // Sequential API calls
      setProgressText('Generating assessment 1');
      setProgress(60);
      const assessment1Response = await fetchData('/pyapi/get_assessment', {
        method: 'POST',
        data: { notes, template_num: 1 }
      });
      const assessment1 = assessment1Response.response;

      setProgressText('Generating assessment 2');
      setProgress(75);
      const assessment2Response = await fetchData('/pyapi/get_assessment', {
        method: 'POST',
        data: { notes, assessment1, template_num: 2 }
      });
      const assessment2 = assessment2Response.response;

      setProgressText('Generating dialog');
      setProgress(90);
      const dialogResponse = await fetchData('/pyapi/get_assessment', {
        method: 'POST',
        data: { notes, assessment1, assessment2, template_num: 3 }
      });
      const dialog = dialogResponse.response;

      setProgress(100);

      if (onAssessmentComplete) {
        onAssessmentComplete({
          notes,
          assessment1,
          assessment2,
          dialog,
        });
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
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
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
    </WidgetWrapper>
  );
};

export default Nightscout;