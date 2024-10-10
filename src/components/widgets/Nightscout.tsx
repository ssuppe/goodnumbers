'use client';

import React, { useState, useEffect } from 'react';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { useSearchParams } from 'next/navigation';
import Progress from '@/components/ui/progress';
import Cookies from "js-cookie";
import axios from 'axios';

const Nightscout: React.FC<NightscoutProps> = ({ header, form, id, hasBackground = false }: NightscoutProps) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const searchParams = useSearchParams();
  const local = searchParams.get('local');

  
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    Cookies.set('url', formData.nightscout_url, {expires : 30});
    Cookies.set('token', formData.nightscout_token, {expires: 30});
    setIsLoading(true);
    setProgress(0);
    setProgressText('Fetching Nightscout data');

    try {
      // Simulating progress for fetching Nightscout data
      for (let i = 0; i <= 25; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('Getting nightscout data');

      // If the token accidentally starts with token=, then remove it
      let nightscout_token = formData['nightscout_token'].toString().replace(/^token=/, '');
      let nightscout_url = formData['nightscout_url'];
      // console.log(nightscout_token);

      let sgvData = null;
      let treatmentsData = null;

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
        //                    /api/v1/entries/sgv.json?token=REDACTED_NIGHTSCOUT_TOKEN_TEST&find[date][$gte]=2024-08-31&count=10000
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
        sgvData = sgvData.filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate >= thirtyDaysAgo;
        });

        // console.log(sgvData);
        treatmentsData = await treatmentsResponse.json();
        // treatmentsData = treatmentsData.filter(item => {
        //   const itemDate = new Date(item.created_at);

        //   return itemDate >= thirtyDaysAgo;
        // });
      } else {
        console.log('Local override, using local data');
      }

      setProgressText('Generating report');
      
      // Simulating progress for getting notes
      for (let i = 51; i <= 75; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const get_notes_response = await axios
        .post('/api/get_notes', {
          sgv: sgvData,
          treatments: treatmentsData,
        })
        .catch(function (error) {
          if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
          }
        });

      const notes = get_notes_response.data;

      // Simulating progress for getting notes
      for (let i = 76; i <= 100; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const get_report_response = await axios.post('/api/get_dialog', {
        notes: notes
      });

      const report = get_report_response.data; 
      console.log(report); // This should log the actual data

      console.log(report.assessment1);

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