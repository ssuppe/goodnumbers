import { useCallback, useState, useEffect } from "react";
import { AssessmentData, PodcastGenerateResult } from "~/types/nightscout";
import { setCookieC, getCookieC } from "~/utils/cookies";

export const useAssessmentState = () => {
  // Initialize with null values
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cookies after mount
  useEffect(() => {
    const loadCookieData = () => {
      try {
        // setIsLoading(true);
        
        const cookieData : AssessmentData = {
          notes: getCookieC<string>('notes'),
          assessment1: getCookieC<string>('assessment1'),
          assessment2: getCookieC<string>('assessment2'),
          dialog: getCookieC<string>('dialog'),
          podcastResult: getCookieC<PodcastGenerateResult>('podcastResult'),
          timestamp: getCookieC<string>('timestamp'),
        };

        // Only update if we have any non-null values
        if (Object.values(cookieData).some(value => value !== null)) {
          setAssessmentData(cookieData as AssessmentData);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading cookie data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cookie data');
      } finally {
        // setIsLoading(false);
      }
    };

    loadCookieData();
  }, []); // Empty dependency array = run once after mount

  const updateAssessmentData = useCallback(async (newData: AssessmentData) => {
    try {
      // Update state first
      setAssessmentData(newData);
      // setPodcastStatus(newData.podcastResult?.status || null);
      
      // Update all cookies in parallel
      await Promise.all([
        setCookieC('notes', newData.notes, { expires: 30 }),
        setCookieC('assessment1', newData.assessment1, { expires: 30 }),
        setCookieC('assessment2', newData.assessment2, { expires: 30 }),
        setCookieC('dialog', newData.dialog, { expires: 30 }),
        setCookieC('podcastResult', newData.podcastResult, { expires: 30 }),
        setCookieC('timestamp', newData.timestamp, { expires: 30 })
      ]);
    } catch (err) {
      console.error('Error updating assessment data:', err);
      throw err;
    }
  }, []);

  const updatePodcastResult = useCallback(async (newPodcastResult: PodcastGenerateResult) => {
    if (!assessmentData) return;

    try {
      const updatedData: AssessmentData =  {
        ...assessmentData,
        podcastResult: newPodcastResult
      } 

      await updateAssessmentData(updatedData);
      // setPodcastStatus(newPodcastResult.status);
    } catch (err) {
      console.error('Error updating podcast result:', err);
      throw err;
    }
  }, []);

  const getCurrentPodcastResult  = useCallback(() => 
    assessmentData?.podcastResult,
    [assessmentData]
  );

  return {
    assessmentData,
    error,
    updateAssessmentData,
    updatePodcastResult,
    getCurrentPodcastResult
  };
};