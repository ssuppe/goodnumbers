"use client";

import React, { useState, useCallback } from "react";
import Headline from "../common/Headline";
import { NightscoutProps } from "~/shared/types";
import WidgetWrapper from "../common/WidgetWrapper";
import NightscoutForm from "./NightscoutForm";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";

interface NightscoutWrapperProps extends NightscoutProps {
  onAssessmentComplete?: (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => void;
  local?: string | null;
}

const NightscoutWrapper: React.FC<NightscoutWrapperProps> = ({
  header,
  id,
  hasBackground = false,
  onAssessmentComplete,
  local,
}) => {
  const [assessmentData, setAssessmentData] = useState<{
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  } | null>(null);

  const handleAssessmentComplete = useCallback((data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => {
    setAssessmentData(data);
  }, []);

  return (
    <WidgetWrapper id={id || ""} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}
      <div className="flex items-stretch justify-center">
        <NightscoutForm
          onAssessmentComplete={handleAssessmentComplete}
          local={local}
        />
      </div>
      {assessmentData && (
        <div className="mt-8 max-w-4xl mx-auto">
          <Tabs>
            <TabList>
              <Tab>Notes</Tab>
              <Tab>Assessment 1</Tab>
              <Tab>Assessment 2</Tab>
              <Tab>Dialog</Tab>
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
              <h2 className="text-xl font-bold mb-2">Dialog</h2>
              <pre className="whitespace-pre-wrap">{assessmentData.dialog}</pre>
            </TabPanel>
          </Tabs>
        </div>
      )}
    </WidgetWrapper>
  );
};

export default NightscoutWrapper;
