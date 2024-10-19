// Nightscout.tsx
"use client";

import React, { useState } from "react";
import Headline from "../common/Headline";
import { NightscoutProps } from "~/shared/types";
import WidgetWrapper from "../common/WidgetWrapper";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import Progress from "../ui/progress";
import Cookies from "js-cookie";
import axios from "axios";
import axiosRetry from "axios-retry";
import { generateAssessments } from "./nightscoutActions";

interface NightscoutComponentProps extends NightscoutProps {
  onAssessmentComplete?: (data: {
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  }) => void;
  local?: string | null;
}

// Create an axios instance with retry configuration
const axiosInstance = axios.create({
  timeout: 300000, // 5 minutes
});

axiosRetry(axiosInstance, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === "ECONNRESET"
    );
  },
});

const NightscoutComponent = ({
  header,
  id,
  hasBackground = false,
  onAssessmentComplete,
}: NightscoutComponentProps): JSX.Element => {
    const [assessmentData, setAssessmentData] = useState<{
    notes: string;
    assessment1: string;
    assessment2: string;
    dialog: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const storedUrl = Cookies.get("url");
  const storedToken = Cookies.get("token");

  const [formData, setFormData] = useState({
    nightscout_url: storedUrl || "",
    nightscout_token: storedToken || "",
    terms_accepted: false,
    demo_data: false
  });

  const isFormValid =
    formData.nightscout_url &&
    formData.nightscout_token &&
    formData.terms_accepted;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fetchNightscoutData = async (nightscout_url: string, nightscout_token: string) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-");

    const sgvUrl = `${nightscout_url}/api/v1/entries/sgv.json?token=${nightscout_token}&find[date][$gte]=${thirtyDaysAgoStr}&count=10000`;
    const treatmentsUrl = `${nightscout_url}/api/v1/treatments.json?token=${nightscout_token}&find[created_at][$gte]=${thirtyDaysAgoStr}&count=20000`;

    try {
      const [sgvResponse, treatmentsResponse] = await Promise.all([
        axiosInstance.get(sgvUrl),
        axiosInstance.get(treatmentsUrl),
      ]);

      const sgvData = sgvResponse.data.filter((item: { date: string }) => new Date(item.date) >= thirtyDaysAgo);
      const treatmentsData = treatmentsResponse.data.filter((item: { created_at: string }) => new Date(item.created_at) >= thirtyDaysAgo);

      return { sgvData, treatmentsData };
    } catch (error) {
      throw new Error("Failed to fetch Nightscout data");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Submitted!");
    setError(null);
    Cookies.set("url", formData.nightscout_url, { expires: 30 });
    Cookies.set("token", formData.nightscout_token, { expires: 30 });
    setIsLoading(true);
    setProgress(0);

    try {
      let sgvData = null;
      let treatmentsData  = null;
      // Fetch Nightscout data using client-side function
      if(!formData.demo_data) {
        let { sgvData, treatmentsData } = await fetchNightscoutData(formData.nightscout_url, formData.nightscout_token);
      } 
      
      console.log("sgvData: " + sgvData);
      setProgressText("Generating assessments");
      setProgress(50);

      // Generate assessments using Server Action
      const data = await generateAssessments(sgvData, treatmentsData, formData.demo_data);

      setAssessmentData(data);

      if (onAssessmentComplete) {
        onAssessmentComplete(data);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setProgress(0);
      setProgressText("");
    }
  };

  return (
    <WidgetWrapper id={id || ""} hasBackground={hasBackground} containerClass="max-w-7xl mx-auto">
      {header && <Headline header={header} titleClass="text-3xl sm:text-5xl" />}
      <div className="flex items-stretch justify-center">
        <form onSubmit={handleSubmit} className="card h-fit max-w-2xl mx-auto p-5 md:p-12">
          {isLoading && (
            <div className="mb-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center mt-2">{progressText}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          <input
            type="text"
            name="nightscout_url"
            placeholder="Nightscout URL"
            value={formData.nightscout_url}
            onChange={handleInputChange}
            className="w-full p-2 mb-4 border rounded"
          />
          <input
            type="text"
            name="nightscout_token"
            placeholder="Nightscout Token"
            value={formData.nightscout_token}
            onChange={handleInputChange}
            className="w-full p-2 mb-4 border rounded"
          />
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              name="terms_accepted"
              checked={formData.terms_accepted}
              onChange={handleInputChange}
              className="mr-2"
            />
            I accept the terms and conditions
          </label>
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              name="demo_data"
              checked={formData.demo_data}
              onChange={handleInputChange}
              className="mr-2"
            />
            Use demo data
          </label>
          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={`w-full p-2 text-white rounded ${
              isFormValid && !isLoading ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {isLoading ? "Creating..." : "Create"}
          </button>
        </form>
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

export default NightscoutComponent;