'use client'

import React from 'react';
import ReactMarkdown from 'react-markdown';
import WidgetWrapper from '../common/WidgetWrapper';
import { PodcastDialogProps } from '~/shared/types';

// const LoadingSpinner = ({ header, id, message, hasBackground = false } : LoadingSpinnerProps) => {

const PodcastDialog = ({ header, id , content, hasBackground = false }) : PodcastDialogProps => {
  return (
    <WidgetWrapper id={id ? id : ''} hasBackground={hasBackground} containerClass="">
    <div id="podcast_dialog" className="mt-8 p-4 bg-white rounded shadow">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
    </WidgetWrapper>
  );
};

export default PodcastDialog;