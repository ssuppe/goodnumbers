'use server';

import { canWriteLocal, canReadLocal } from '@/utils/env';
import { writeLocalFile, readLocalFile } from '@/utils/fileCache';
import { AssessmentData, PodcastGenerateResult, ReportItem, NightscoutData } from '@/types/nightscout';
import { Compressed } from 'compress-json';

/**
 * Comprehensive data structure that includes all assessment data
 * Used for demo purposes to store/retrieve complete assessment results
 */
export interface ComprehensiveAssessmentData {
  // Core assessment data
  assessmentData: AssessmentData;

  // Raw Nightscout API data
  nightscoutData: {
    entries: Compressed;
    treatments: Compressed;
    profiles: Compressed;
  };

  // Extracted for easy access
  reportItems: ReportItem[];
  podcastResult: PodcastGenerateResult | null;

  // Metadata
  timestamp: string;
  id: string;
}

/**
 * Writes comprehensive assessment data to local storage for demo purposes
 * Only works when canWriteLocal() is true
 */
export async function writeAssessmentDemoData(data: ComprehensiveAssessmentData): Promise<boolean> {
  if (!canWriteLocal()) {
    console.warn('Cannot write demo data - local writing is disabled');
    return false;
  }

  try {
    await writeLocalFile(data, {
      filename: `gemini/comprehensive/${data.id}.json`,
      plainText: false,
    });
    console.log(`Successfully wrote demo data for ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('Failed to write comprehensive assessment data:', error);
    return false;
  }
}

/**
 * Reads comprehensive assessment data from local storage
 * Only works when canReadLocal() is true
 */
export async function readAssessmentDemoData(id: string): Promise<ComprehensiveAssessmentData | null> {
  try {
    const data = await readLocalFile<ComprehensiveAssessmentData>({
      filename: `gemini/comprehensive/${id}.json`,
      plainText: false,
    });
    console.log(`Successfully read demo data for ID: ${id}`);
    return data;
  } catch (error) {
    console.warn(`Failed to read demo data for ID ${id}:`, error);
    return null;
  }
}

/**
 * Gets available demo IDs by checking what files exist
 * TODO: This implementation is simplified and assumes known demo IDs
 * A full implementation would need to read the filesystem
 */
export async function getAvailableDemoIds(): Promise<string[]> {
  if (!canReadLocal()) {
    console.warn('Cannot get demo IDs - local reading is disabled');
    return [];
  }

  try {
    // For now, return a predefined list of demo IDs
    // In a full implementation, this would scan the directory
    return ['demo1', 'demo2', 'demo3'];
  } catch (error) {
    console.error('Failed to get available demo IDs:', error);
    return [];
  }
}
