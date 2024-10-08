'use client'

import { LoadingSpinnerProps } from '~/shared/types';
import React from 'react';
import WidgetWrapper from '../common/WidgetWrapper';

const LoadingSpinner = ({ header, id, message, hasBackground = false } : LoadingSpinnerProps) => {
  return (
    <WidgetWrapper id={id ? id : ''} hasBackground={hasBackground} containerClass="">
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>{message}</p>
        </div>
      </div>
    </WidgetWrapper>
  );
};

export default LoadingSpinner;
