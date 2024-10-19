"use client";

import React, { useState, Suspense } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import { useSearchParams } from 'next/navigation'


import NightscoutWrapper from "~/components/widgets/Nightscout";
import { nightscout } from "~/shared/data/pages/trynow.data";

const Page = () => {
  const [assessmentData, setAssessmentData] = useState<{
    notes: string | null;
    assessment1: string | null;
    assessment2: string | null;
    dialog: string | null;
  } | null>(null);

  const handleAssessmentComplete = (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => {
    setAssessmentData(data);
  };

  const searchParams =  useSearchParams();
  const local = searchParams.get("local");
console.log("Local? " + local);
  const header = {
    title: "Your Nightscout Analysis"
  };

  return (
    <>
      <NightscoutWrapper
        header={header}
        id="nightscout-analysis"
        hasBackground={true}
        onAssessmentComplete={handleAssessmentComplete}
        local={local}
      />
    </>
  );
};

export default Page;
