'use client'

import React, { useState } from 'react';
import Form from '../common/Form';
import Headline from '../common/Headline';
import { NightscoutProps } from '~/shared/types';
import WidgetWrapper from '../common/WidgetWrapper';
import PodcastDialog from './PodcastDialog';
import LoadingSpinner from './LoadingSpinner';
import Cookies from "js-cookie";

const Nightscout: React.FC<NightscoutProps> = ({ header, form, id, hasBackground = false }: NightscoutProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [podcastDialog, setPodcastDialog] = useState('');

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);

    try {
      console.log("Getting nightscout data");
      // 1) Get Nightscout data
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