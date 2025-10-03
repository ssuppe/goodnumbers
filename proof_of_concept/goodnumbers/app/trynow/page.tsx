'use client';

import { ErrorBoundary } from '@/components/widgets/ErrorBoundary';
import NightscoutComponent from '@/components/widgets/Nightscout';
import 'react-tabs/style/react-tabs.css';

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
