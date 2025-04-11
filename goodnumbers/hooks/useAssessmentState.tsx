import { useCallback, useState, useEffect } from 'react';
import { AssessmentData, PodcastGenerateResult } from '@/types/nightscout';
import { 
  saveAssessmentData, 
  loadAssessmentData
} from '@/utils/assessmentStorage';

export const useAssessmentState = () => {
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load assessment data from localStorage after mount
  useEffect(() => {
    try {
      const storedData = loadAssessmentData();
      
      if (storedData) {
        console.log('Setting assessment data with ssml_dialog:', storedData.ssml_dialog ? 'Present' : 'Not present');
        console.log(
          'Setting assessment data with report_items:',
          storedData.report_items ? `Present (${storedData.report_items.length} items)` : 'Not present',
        );
        setAssessmentData(storedData);
      }

      setError(null);
    } catch (err) {
      console.error('Error loading assessment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assessment data');
    }
  }, []);

  const updateAssessmentData = useCallback((newData: AssessmentData) => {
    // Update state immediately
    setAssessmentData(newData);

    // Log SSML dialog before saving
    console.log(
      'Saving ssml_dialog:',
      newData.ssml_dialog ? 'Present (length: ' + newData.ssml_dialog.length + ')' : 'Not present',
    );

    // Synchronously save all assessment data at once
    try {
      saveAssessmentData(newData);
    } catch (err) {
      console.error('Error saving assessment data:', err);
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

      // Save the complete assessment data
      try {
        saveAssessmentData(updatedData);
      } catch (err) {
        console.error('Error updating podcast result in assessment data:', err);
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
