import { useState } from "react";
import { AssessmentData, PodcastGenerateResult } from "~/types/nightscout";
import { setCookieC } from "~/utils/cookies";

// hooks/useAssessmentState.ts
export const useAssessmentState = (initialStoredData: {
    notes: string | null;
    assessment1: string | null;
    assessment2: string | null;
    dialog: string | null;
    podcastResult: PodcastGenerateResult | null;
    timestamp : string | null;
  }) => {
    // Single source of truth for assessment data
    const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
    const [podcastStatus, setPodcastStatus] = useState<string | null>(
      initialStoredData.podcastResult?.status || null
    );
  
    // Helper function to update cookies
    const updateAssessmentData = async (newData: AssessmentData) => {
      setAssessmentData(newData);
      
      // Update cookies in one place
      await setCookieC('notes', newData.notes);
      await setCookieC('assessment1', newData.assessment1);
      await setCookieC('assessment2', newData.assessment2);
      await setCookieC('dialog', newData.dialog);
      await setCookieC('podcast_result', JSON.stringify(newData.podcastResult));
      await setCookieC('timestamp', newData.timestamp);
    };
  
    return {
      assessmentData,
      updateAssessmentData,
      podcastStatus,
      setPodcastStatus,
      // Get current podcast result from single source of truth
      getCurrentPodcastResult: () => assessmentData?.podcastResult || initialStoredData.podcastResult
    };
  };