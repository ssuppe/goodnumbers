'use client';

import React, { useState } from 'react';
import Form from '../common/Form';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import { useSearchParams } from 'next/navigation';
import PodcastDialog from './PodcastDialog';
import LoadingSpinner from './LoadingSpinner';
import Cookies from 'js-cookie';
import axios from 'axios';


const Nightscout: React.FC<NightscoutProps> = ({ header, form, id, hasBackground = false }: NightscoutProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [podcastDialog, setPodcastDialog] = useState('');
  const searchParams = useSearchParams();
  const local = searchParams.get('local');

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);

    try {

      // 1. Get Nighscout data
      console.log('Getting nightscout data');

      // If the token accidentally starts with token=, then remove it
      let nightscout_token = formData['nightscout_token'].toString().replace(/^token=/, '');
      let nightscout_url = formData['nightscout_url'];
      console.log(nightscout_token);

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
          throw new Error('API request failed');
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



      // 1) Get Nightscout notes
      const get_notes_response = await axios.post('http://localhost:5000/api/get_notes', {
        sgv: sgvData,
        treatments: treatmentsData
      });
      
      const notes = get_notes_response.data;
      console.log(notes);
      // const nightscoutResponse = await fetch('/api/getNightscoutData', {
      //   method: 'POST',
      //   body: formData,
      // });

      // if (!nightscoutResponse.ok) {
      //   throw new Error(`Nightscout data fetch failed: ${nightscoutResponse.statusText}`);
      // }

      // const { treatments, carbs } = await nightscoutResponse.json();

      // // 1.5) Update spinner message
      // setIsLoading(true);

      // // Construct notes for the podcast
      // const notes = `Treatments: ${JSON.stringify(treatments)}, Carbs: ${JSON.stringify(carbs)}`;

      // // 2) Get podcast dialog
      // const podcastResponse = await fetch('/api/getPodcast', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ notes }),
      // });

      // if (!podcastResponse.ok) {
      //   throw new Error(`Podcast fetch failed: ${podcastResponse.statusText}`);
      // }

      // const { podcast_dialog } = await podcastResponse.json();
      // setPodcastDialog(podcast_dialog);
    } catch (error) {
      console.error('Error submitting form:', error);
      // Handle error, e.g., show an error message to the user
    } finally {
      // 4) Reset loading state and re-enable button
      setIsLoading(false);
    }
  };

  return (
    <WidgetWrapper id={id ? id : ''} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}
      <div className="flex items-stretch justify-center">
        <Form
          {...form}
          containerClass="card h-fit max-w-2xl mx-auto p-5 md:p-12"
          btnPosition="right"
          isLoading={isLoading}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />
      </div>
    </WidgetWrapper>
  );
};

export default Nightscout;
