'use client';

import React, { useState, Suspense } from 'react';
import 'react-tabs/style/react-tabs.css';
import NightscoutComponent from '~/components/widgets/Nightscout';
import ErrorBoundary from '~/components/common/ErrorBoundary';

const Page = () => {
  const header = {
    title: 'Your Nightscout Analysis',
  };

  return (
    <>
      <ErrorBoundary>
        <NightscoutComponent header={header} id="nightscout-analysis" hasBackground={true} />
      </ErrorBoundary>
    </>
  );
};

export default Page;
