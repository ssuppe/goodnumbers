import { AssessmentInsight } from '@/types/nightscout.d';

/**
 * Interface for all insight generators
 * Each generator should implement methods to return both AI and user insights
 */
export interface InsightGenerator {
  /**
   * Returns an insight formatted for AI analysis
   * Written in the tone of a medical health care professional's notes
   */
  getAIInsight(): AssessmentInsight;
  
  /**
   * Returns an insight formatted for user-friendly display
   * Written in a patient-friendly tone for web display
   */
  getUserInsight(): AssessmentInsight;
}
