'use client';

import React, { useState, useEffect } from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { useSearchParams } from 'next/navigation';
import Progress from '@/components/ui/progress';
import Cookies from 'js-cookie';
import axios from 'axios';

// Extend the NightscoutProps interface to include the new callback
interface ExtendedNightscoutProps extends NightscoutProps {
  onAssessmentComplete?: (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    assessment3: string;
  }) => void;
}

const Nightscout: React.FC<ExtendedNightscoutProps> = ({ header, form, id, hasBackground = false, onAssessmentComplete }: ExtendedNightscoutProps) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const searchParams = useSearchParams();
  const local = searchParams ? searchParams.get('local') : null;

  const storedUrl = Cookies.get('url');
  const storedToken = Cookies.get('token');

  const [formData, setFormData] = useState({
    nightscout_url: storedUrl ? storedUrl : '',
    nightscout_token: storedToken ? storedToken : '',
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    Cookies.set('url', formData.nightscout_url, { expires: 30 });
    Cookies.set('token', formData.nightscout_token, { expires: 30 });
    setIsLoading(true);
    setProgress(0);
    setProgressText('Fetching Nightscout data');

    try {
      // Simulating progress for fetching Nightscout data
      for (let i = 0; i <= 25; i++) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      console.log('Getting nightscout data');

      // If the token accidentally starts with token=, then remove it
      let nightscout_token = formData['nightscout_token'].toString().replace(/^token=/, '');
      let nightscout_url = formData['nightscout_url'];
      // console.log(nightscout_token);

      let sgvData = null;
      let treatmentsData = null;
      let getNotesResponse = null;

      const options = {
        timeout: 180000, // Timeout in milliseconds (120 seconds = 2 minutes)
        // ... your other axios options ... 
      };

      if (!local) {
        console.log('Not local, calling Nightscout');
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
        const thirtyDaysAgoStr = thirtyDaysAgo
          .toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
          .replace(/\//g, '-');
        //                    /api/v1/entries/sgv.json?token=autotune-ca4f6201c17a55b0&find[date][$gte]=2024-08-31&count=10000
        const sgvUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${thirtyDaysAgoStr}&count=10000`;
        console.log(`svgURL: ${sgvUrl}`);
        const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${thirtyDaysAgoStr}&count=20000`;
        console.log(`treatmentsUrl: ${treatmentsUrl}`);
        const [entriesResponse, treatmentsResponse] = await Promise.all([
          fetch(sgvUrl, { headers: { accept: 'application/json' } }),
          fetch(treatmentsUrl, { headers: { accept: 'application/json' } }),
        ]);

        if (!entriesResponse.ok || !treatmentsResponse.ok) {
          throw new Error('Nightscout API request failed');
        }

        sgvData = await entriesResponse.json();
        // console.log(sgvData);
        sgvData = sgvData.filter((item: { date: string }) => {
          const itemDate = new Date(item.date);
          return itemDate >= thirtyDaysAgo;
        });

        // console.log(sgvData);
        treatmentsData = await treatmentsResponse.json();
        treatmentsData = treatmentsData.filter(item => {
          const itemDate = new Date(item.created_at);

          return itemDate >= thirtyDaysAgo;
        });

        getNotesResponse = await axios.post('/pyapi/get_notes', {
          treatments: sgvData ? JSON.stringify(sgvData) : undefined,
          carbs: treatmentsData ? JSON.stringify(treatmentsData) : undefined,
        }, options);
      } else {
        console.log('Local override, using local data');
        getNotesResponse = await axios.post('/pyapi/get_notes', {
          treatments: null,
          carbs: null,
        }, options);
      }

      setProgressText('Generating report');

      // Simulating progress for getting notes
      for (let i = 25; i <= 50; i++) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      try {
        // Access the response data:
        const notes = getNotesResponse.data;
        console.log("Notes: " + notes.substring(0,100)); // Log the response data

        // Simulating progress for getting notes
        for (let i = 76; i <= 100; i++) {
          setProgress(i);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const get_assessment1_response = await axios.post('/pyapi/get_assessment', {
          notes: notes,
          template_num : 1
        }, options);

        const assessment1 = get_assessment1_response.data.response;
        console.log("ASSESSMENT 1:" + assessment1.substring(0,100));
        
        const get_assessment2_response = await axios.post('/pyapi/get_assessment', {
          notes: notes,
          assessment1 : assessment1,
          template_num : 2
        }, options);
        const assessment2 = get_assessment2_response.data.response;
        console.log("ASSESSMENT 2:" + assessment2.substring(0,100));

        const get_assessment3_response = await axios.post('/pyapi/get_assessment', {
          notes: notes,
          assessment1 : assessment1,
          assessment2 : assessment2,
          template_num : 3
        }, options);
        const assessment3 = get_assessment3_response.data.response;
        console.log("ASSESSMENT 3:" + assessment3.substring(0,100));

        // Call the onAssessmentComplete callback with the assessment data
        if (onAssessmentComplete) {
          onAssessmentComplete({
            notes,
            assessment1,
            assessment2,
            assessment3
          });
        }

      } catch (error) {
        if (axios.isAxiosError(error)) {
          // Handle Axios errors (network errors, server errors)
          console.error('Axios Error:', error.message);
          if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
          }
        } else {
          // Handle other types of errors
          console.error('Unexpected Error:', error);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      // Handle error, e.g., show an error message to the user
    } finally {
      setIsLoading(false);
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <WidgetWrapper id={id ? id : ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}
      <div className="flex items-stretch justify-center">
        <form onSubmit={handleSubmit} className="card h-fit max-w-2xl mx-auto p-5 md:p-12">
          {isLoading && (
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center mt-2">{progressText}</p>
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