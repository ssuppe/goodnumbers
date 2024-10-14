'use client';

import React, { useState } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

import Nightscout from '~/components/widgets/Nightscout';
import { nightscout } from '~/shared/data/pages/trynow.data';

const Page = () => {
  const [assessmentData, setAssessmentData] = useState<{
    notes: string;
    assessment1: string;
    assessment2: string;
    assessment3: string;
  } | null>(null);

  const handleAssessmentComplete = (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    assessment3: string;
  }) => {
    setAssessmentData(data);
  };

  return (
    <>
      <Nightscout {...nightscout} onAssessmentComplete={handleAssessmentComplete} />
      {assessmentData && (
        <div className="mt-8 max-w-4xl mx-auto">
          <Tabs>
            <TabList>
              <Tab>Notes</Tab>
              <Tab>Assessment 1</Tab>
              <Tab>Assessment 2</Tab>
              <Tab>Assessment 3</Tab>
            </TabList>

            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Notes</h2>
              <pre className="whitespace-pre-wrap">{assessmentData.notes}</pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Assessment 1</h2>
              <pre className="whitespace-pre-wrap">{assessmentData.assessment1}</pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Assessment 2</h2>
              <pre className="whitespace-pre-wrap">{assessmentData.assessment2}</pre>
            </TabPanel>
            <TabPanel>
              <h2 className="text-xl font-bold mb-2">Assessment 3</h2>
              <pre className="whitespace-pre-wrap">{assessmentData.assessment3}</pre>
            </TabPanel>
          </Tabs>
        </div>
      )}
    </>
  );
};

export default Page;