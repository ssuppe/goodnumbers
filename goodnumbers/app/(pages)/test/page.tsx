'use client';

import React, { useState, Suspense } from 'react';
import 'react-tabs/style/react-tabs.css';
import NightscoutTestComponent from '~/components/widgets/NightscoutTest';
import ErrorBoundary from '~/components/common/ErrorBoundary';

const Page = () => {
  const header = {
    title: 'Your Nightscout Analysis',
  };

  return (
    <>
      <ErrorBoundary>
        <NightscoutTestComponent header={header} id="nightscout-analysis" hasBackground={true} />
      </ErrorBoundary>
    </>
  );
};

export default Page;
