import { AssessmentInsight, GlucoseUnits, InsightPriority } from '@/types/nightscout.d';
import { GLUCOSE_RANGES } from './gn-constants';
import { AnalysisResult } from './gn-meal-analysis';
import { u } from '@/utils/text';
import { hasCriticalInsights, filterCriticalInsights } from '@/actions/nightscoutActions';
import {
  createBasicStatsInsight,
  createBasicGMIStatsInsight,
  createAvgGlucoseInsight,
  createLowPercentageInsight,
  createGMIInsight,
  createGMIvsTimeInRangeInsight,
  createTimeInRangeInsight,
} from '../insights';

export interface PatientRange {
  average_name: 'low' | 'in target' | 'in tight range' | 'in range' | 'high';
  average: number;
  target_low: number;
  target_high: number;
  very_high: number;
}

export function getPatientsRange(compositeday_analysis: AnalysisResult): PatientRange {
  const pr: PatientRange = {
    average_name: 'low',
    average: 0,
    target_low: 0,
    target_high: 0,
    very_high: 0,
  };

  pr.average = compositeday_analysis.avgGlucose;

  // If their average is low, then we are just trying to get them in
  // the widest acceptable range
  if (
    compositeday_analysis.avgGlucose < GLUCOSE_RANGES.LOW ||
    compositeday_analysis.avgGlucose < GLUCOSE_RANGES.VERY_LOW
  ) {
    pr.average_name = 'low';
    pr.target_low = GLUCOSE_RANGES.LOW;
    pr.target_high = GLUCOSE_RANGES.HIGH;
    pr.very_high = GLUCOSE_RANGES.VERY_HIGH;
    // If their average is within target, then target is target, and
    // high is TITR
  } else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.TARGET_BOTTOM &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TARGET_TOP
  ) {
    pr.average_name = 'in target';
    pr.target_low = GLUCOSE_RANGES.TARGET_BOTTOM;
    pr.target_high = GLUCOSE_RANGES.TARGET_TOP;
    pr.very_high = GLUCOSE_RANGES.TITR_HIGH;
  }
  // If their average is within TITR, then target is target, and high is TTIR
  else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TITR_HIGH
  ) {
    pr.average_name = 'in tight range';
    pr.target_low = GLUCOSE_RANGES.TARGET_BOTTOM;
    pr.target_high = GLUCOSE_RANGES.TARGET_TOP;
    pr.very_high = GLUCOSE_RANGES.TITR_HIGH;
  }
  // If their average is within LOW HIGH, then target low should be target bottom,
  // but target high should be TITR_HIGH (next lowest). Very high becomes
  // HIGH
  else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.HIGH
  ) {
    pr.average_name = 'in range';
    pr.target_low = GLUCOSE_RANGES.TARGET_BOTTOM;
    pr.target_high = GLUCOSE_RANGES.TITR_HIGH;
    pr.very_high = GLUCOSE_RANGES.HIGH;
  }
  // Otherwise they are above high, and so we need to get them into range
  else {
    pr.average_name = 'high';
    pr.target_low = GLUCOSE_RANGES.LOW;
    pr.target_high = GLUCOSE_RANGES.HIGH;
    pr.very_high = GLUCOSE_RANGES.HIGH;
  }

  return pr;
}

export async function getWeekOverview(
  compositeday_analysis: AnalysisResult,
  preferred_units: GlucoseUnits,
  patient_range: PatientRange,
): Promise<{ ai_insights: AssessmentInsight[]; user_insights: AssessmentInsight[] }> {
  const ai_insights: AssessmentInsight[] = [];
  const user_insights: AssessmentInsight[] = [];

  // Use the basic stats insight generator
  const basicStatsInsight = createBasicStatsInsight(compositeday_analysis, preferred_units);
  ai_insights.push(basicStatsInsight.getAIInsight());
  user_insights.push(basicStatsInsight.getUserInsight());

  // Use the average glucose insight generator
  const avgGlucoseInsight = createAvgGlucoseInsight(compositeday_analysis, preferred_units);
  ai_insights.push(avgGlucoseInsight.getAIInsight());
  user_insights.push(avgGlucoseInsight.getUserInsight());

  // Use the low percentage insight generator
  const lowPercentageInsight = createLowPercentageInsight(compositeday_analysis);
  ai_insights.push(lowPercentageInsight.getAIInsight());
  user_insights.push(lowPercentageInsight.getUserInsight());

  // Use the basic GMI stats insight generator
  const basicGMIStatsInsight = createBasicGMIStatsInsight(compositeday_analysis);
  ai_insights.push(basicGMIStatsInsight.getAIInsight());
  user_insights.push(basicGMIStatsInsight.getUserInsight());

  // Use the GMI insight generator for detailed GMI insights
  const gmiInsight = createGMIInsight(compositeday_analysis);
  ai_insights.push(gmiInsight.getAIInsight());
  user_insights.push(gmiInsight.getUserInsight());

  // Use the GMI vs Time in Range correlation insight generator
  const gmiVsTirInsight = createGMIvsTimeInRangeInsight(compositeday_analysis);
  ai_insights.push(gmiVsTirInsight.getAIInsight());
  user_insights.push(gmiVsTirInsight.getUserInsight());

  /////////////////////////////////////////////////////////////////////////////
  // If there are any critical insights, let's quit now. We are unable to
  // continue as the patient as severe issues.
  ////////////////////////////////////////////////////////////////////////////
  var hasCritical: boolean = await hasCriticalInsights(ai_insights);
  if (hasCritical) {
    return {
      ai_insights: await filterCriticalInsights(ai_insights)!,
      user_insights: await filterCriticalInsights(user_insights)!,
    };
  }

  ////////////////////////////////////////////////////////////////////////////
  // Cover standard TIR evaluation to baseline everyone
  ////////////////////////////////////////////////////////////////////////////
  // Use the Time in Range insight generator (if we have info on how many days of data)
  const num_days = 7; // Assuming a week of data, adjust as needed
  const timeInRangeInsight = createTimeInRangeInsight(compositeday_analysis, preferred_units, num_days);
  ai_insights.push(timeInRangeInsight.getAIInsight());
  user_insights.push(timeInRangeInsight.getUserInsight());

  /////////////////////////////////////////////////////////////////////////////
  // Establish patient relative range
  /////////////////////////////////////////////////////////////////////////////
  let note = `Before we go further, we are going to set improvement goals that make sense for where you blood sugar numbers are right now. Because your average is ${patient_range.average_name}, we are going to consider anything above ${u(patient_range.target_high, preferred_units)} to be high. This is just for purposes of this analysis, and doesn't mean you are actually high - talk to your doctor if you have questions. `;

  if (patient_range.target_high != patient_range.very_high) {
    note += `And we'll consider ${u(patient_range.very_high, preferred_units)} to be very high.\n\n`;
  }

  ai_insights.push({ note: note, priority: InsightPriority.ALWAYS_INCLUDE });
  user_insights.push({ note: note, priority: InsightPriority.ALWAYS_INCLUDE });

  return { ai_insights, user_insights };
}
