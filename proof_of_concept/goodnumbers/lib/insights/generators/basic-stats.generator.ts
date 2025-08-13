import { AssessmentInsight, GlucoseUnits, InsightPriority } from '@/types/nightscout.d';
import { AnalysisResult } from '../../oref0-autotune/gn-meal-analysis';
import { u } from '@/utils/text';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Calculate the Glucose Management Indicator (GMI) based on average glucose.
 * Formula: 3.31 + (0.02392 × mean glucose in mg/dL)
 * @param avgGlucose Average glucose in mg/dL
 * @returns GMI value as a percentage
 */
function calculateGMI(avgGlucose: number): number {
  return 3.31 + 0.02392 * avgGlucose;
}

/**
 * Creates a generator for basic glucose statistics insights
 * @param compositeday_analysis Analysis result containing glucose data
 * @param preferred_units The user's preferred glucose units (mg/dL or mmol/L)
 * @returns An InsightGenerator for basic statistics insights
 */
export function createBasicStatsInsight(
  compositeday_analysis: AnalysisResult, 
  preferred_units: GlucoseUnits
): InsightGenerator {
  return {
    getAIInsight(): AssessmentInsight {
      const note = `  * This week was the patient's average blood glucose was ${u(compositeday_analysis.avgGlucose, preferred_units)}\n`;
      return { 
        note, 
        priority: InsightPriority.ALWAYS_INCLUDE 
      };
    },
    
    getUserInsight(): AssessmentInsight {
      const note = `Average weekly glucose: ${u(compositeday_analysis.avgGlucose, preferred_units)}\n`;
      return { 
        note, 
        priority: InsightPriority.ALWAYS_INCLUDE 
      };
    }
  };
}

/**
 * Creates a generator for basic GMI statistic insight
 * @param compositeday_analysis Analysis result containing glucose data
 * @returns An InsightGenerator for basic GMI statistic insight
 */
export function createBasicGMIStatsInsight(compositeday_analysis: AnalysisResult): InsightGenerator {
  // Calculate GMI once and reuse
  const gmi = calculateGMI(compositeday_analysis.avgGlucose);
  
  return {
    getAIInsight(): AssessmentInsight {
      const note = `  * The patient's estimated Glucose Management Indicator (GMI) is ${gmi.toFixed(1)}%\n`;
      return { 
        note, 
        priority: InsightPriority.ALWAYS_INCLUDE 
      };
    },
    
    getUserInsight(): AssessmentInsight {
      const note = `Estimated GMI: ${gmi.toFixed(1)}%\n`;
      return { 
        note, 
        priority: InsightPriority.ALWAYS_INCLUDE 
      };
    }
  };
}
