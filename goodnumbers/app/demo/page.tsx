'use client';

import { ErrorBoundary } from '@/components/widgets/ErrorBoundary';
import NightscoutDemoComponent from '@/components/widgets/NightscoutDemo';
import 'react-tabs/style/react-tabs.css';

const Page = () => {
  const header: Header = {
    title: 'Nightscout demo',
  };

  return (
    <>
      <ErrorBoundary>
        <NightscoutDemoComponent header={header} id="nightscout-analysis" hasBackground={true} />
      </ErrorBoundary>
    </>
  );
};

export default Page;
