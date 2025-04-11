import { useCallback, useState, useEffect } from 'react';
import { AssessmentData, GlucoseUnits, PodcastGenerateResult, ReportItem } from '@/types/nightscout';
import { setCookieCSync, getCookieC } from '@/utils/cookies';

export const useAssessmentState = () => {
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cookies after mount
  useEffect(() => {
    try {
      const ssmlDialog = getCookieC<string>('ssml_dialog');
      console.log('Loading ssml_dialog from cookie:', ssmlDialog ? 'Found (length: ' + ssmlDialog.length + ')' : 'Not found');
      
      const reportItems = getCookieC<ReportItem[]>('report_items');
      console.log('Loading report_items from cookie:', 
        reportItems ? 
        `Found (${reportItems.length} items, first item has ${reportItems[0]?.data?.length || 0} data points)` : 
        'Not found');
      
      const cookieData: AssessmentData = {
        valid: getCookieC<boolean>('valid'),
        notes: getCookieC<string>('notes'),
        assessment1: getCookieC<string>('assessment1'),
        assessment2: getCookieC<string>('assessment2'),
        title: getCookieC<string>('title'),
        description: getCookieC<string>('description'),
        ssml_dialog: ssmlDialog,
        template_num: 0,
        timestamp: getCookieC<string>('timestamp'),
        id: getCookieC<string>('id'),
        podcastResult: getCookieC<PodcastGenerateResult>('podcastResult'),
        preferred_units: getCookieC<GlucoseUnits>('preferred_units'),
        report_items: reportItems,
      };

      // Only update if we have any non-null values
      if (Object.values(cookieData).some((value) => value !== null)) {
        console.log('Setting assessment data with ssml_dialog:', cookieData.ssml_dialog ? 'Present' : 'Not present');
        console.log('Setting assessment data with report_items:', 
          cookieData.report_items ? 
          `Present (${cookieData.report_items.length} items)` : 
          'Not present');
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

    // Log SSML dialog before saving
    console.log('Saving ssml_dialog to cookie:', newData.ssml_dialog ? 'Present (length: ' + newData.ssml_dialog.length + ')' : 'Not present');
    
    // Log report_items before saving
    console.log('Saving report_items to cookie:', 
      newData.report_items ? 
      `Present (${newData.report_items.length} items, first item has ${newData.report_items[0]?.data?.length || 0} data points)` : 
      'Not present');
    
    if (newData.report_items && newData.report_items.length > 0 && newData.report_items[0]?.data) {
      console.log('First report item data sample:', 
        JSON.stringify(newData.report_items[0].data[0], null, 2).substring(0, 100) + '...');
    }

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
      setCookieCSync('report_items', newData.report_items, { expires: 30 });
      
      // Verify it was saved correctly
      setTimeout(() => {
        const savedSsml = getCookieC<string>('ssml_dialog');
        console.log('Verified ssml_dialog cookie:', savedSsml ? 'Successfully saved (length: ' + savedSsml.length + ')' : 'Failed to save');
        
        const savedReportItems = getCookieC<ReportItem[]>('report_items');
        console.log('Verified report_items cookie:', 
          savedReportItems ? 
          `Successfully saved (${savedReportItems.length} items, first item has ${savedReportItems[0]?.data?.length || 0} data points)` : 
          'Failed to save');
      }, 100);
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
