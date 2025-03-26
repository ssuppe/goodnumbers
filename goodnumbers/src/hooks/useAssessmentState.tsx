import { useCallback, useState, useEffect } from 'react';
import { TidelineConfig } from '~/components/tideline/tideline-chart-spec';
import { AssessmentData, GlucoseUnits, PodcastGenerateResult } from '~/types/nightscout';
import { setCookieCSync, getCookieC } from '~/utils/cookies';

export const useAssessmentState = () => {
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cookies after mount
  useEffect(() => {
    try {
      const cookieData: AssessmentData = {
        valid: getCookieC<boolean>('valid'),
        notes: getCookieC<string>('notes'),
        assessment1: getCookieC<string>('assessment1'),
        assessment2: getCookieC<string>('assessment2'),
        title: getCookieC<string>('title'),
        description: getCookieC<string>('description'),
        ssml_dialog: getCookieC<string>('ssml_dialog'),
        template_num: 0,
        timestamp: getCookieC<string>('timestamp'),
        id: getCookieC<string>('id'),
        podcastResult: getCookieC<PodcastGenerateResult>('podcastResult'),
        preferred_units: getCookieC<GlucoseUnits>('preferred_units'),
        charts: getCookieC<TidelineConfig[]>('charts'),
      };

      // Only update if we have any non-null values
      if (Object.values(cookieData).some((value) => value !== null)) {
        setAssessmentData(cookieData as AssessmentData);
      }

      setError(null);
    } catch (err) {
      console.error('Error loading cookie data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cookie data');
    }
  }, []);

  const updateAssessmentData = useCallback((newData: AssessmentData) => {
    // Update state immediately
    setAssessmentData(newData);

    // Use synchronous cookie updates
    try {
      setCookieCSync('valid', newData.valid, { expires: 30 });
      setCookieCSync('notes', newData.notes, { expires: 30 });
      setCookieCSync('assessment1', newData.assessment1, { expires: 30 });
      setCookieCSync('assessment2', newData.assessment2, { expires: 30 });
      setCookieCSync('title', newData.title, { expires: 30 });
      setCookieCSync('description', newData.description, { expires: 30 });
      setCookieCSync('ssml_dialog', newData.ssml_dialog, { expires: 30 });
      setCookieCSync('units', newData.preferred_units);
      // setCookieCSync('template_num', newData.template_num, { expires: 30 });
      setCookieCSync('timestamp', newData.timestamp, { expires: 30 });
      setCookieCSync('id', newData.id, { expires: 30 });
      setCookieCSync('podcastResult', newData.podcastResult, { expires: 30 });
      setCookieCSync('charts', newData.charts, { expires: 30 });
    } catch (err) {
      console.error('Error updating cookies:', err);
    }
  }, []);

  const updatePodcastResult = useCallback(
    (newPodcastResult: PodcastGenerateResult) => {
      if (!assessmentData) return;

      const updatedData: AssessmentData = {
        ...assessmentData,
        podcastResult: newPodcastResult,
      };

      // Update state immediately
      setAssessmentData(updatedData);

      // Use synchronous cookie update
      try {
        setCookieCSync('podcastResult', newPodcastResult, { expires: 30 });
      } catch (err) {
        console.error('Error updating podcast result cookie:', err);
      }
    },
    [assessmentData],
  );

  const getCurrentPodcastResult = useCallback(() => {
    return assessmentData?.podcastResult || null;
  }, [assessmentData]);

  return {
    assessmentData,
    error,
    updateAssessmentData,
    updatePodcastResult,
    getCurrentPodcastResult,
  };
};
