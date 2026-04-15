import { GlucoseUnit, Insight, InsightPriority } from '@goodnumbers/types';
import { u } from '../../utils/text.js';
import { AnalysisResult, InsightGenerator } from './interfaces.js';

// Constants as per specification
const TBR_LIMIT = 4.0; // 4%
const HYPO_LIMIT = 70; // mg/dL
const TIGHT_LIMIT = 140; // mg/dL
const HIGH_LIMIT = 180; // mg/dL

export function createAvgGlucoseInsight(
  analysis: AnalysisResult,
  units: GlucoseUnit,
): InsightGenerator {
  return {
    generate(): Insight {
      const avg = analysis.avgGlucose;
      const tbr = analysis.lowPercentage;

      let priority: InsightPriority;
      let note: string;

      // State A: Critical Low (avg < 70)
      if (avg < HYPO_LIMIT) {
        priority = InsightPriority.CRITICAL;
        note = `Your average glucose is dangerously low (${u(avg, units)}). This requires urgent attention as it indicates frequent or prolonged hypoglycemia. Please consult your doctor immediately.`;
      }
      // State B: Masked Low (avg < 140 AND TBR > 4%)
      else if (avg < TIGHT_LIMIT && tbr > TBR_LIMIT) {
        priority = InsightPriority.CRITICAL;
        note = `Your average glucose is ${u(avg, units)}, but this is hiding a problem. You spent ${tbr.toFixed(1)}% of time below range. This "masked hypoglycemia" means your good average is coming at the cost of dangerous lows. Focus on reducing lows before worrying about highs.`;
      }
      // State C: Elevated (avg > 180)
      else if (avg > HIGH_LIMIT) {
        priority = InsightPriority.INFO; // INFO maps to ALWAYS_INCLUDE
        note = `Your average glucose is ${u(avg, units)}, which is higher than the recommended target. This suggests significant time in hyperglycemia.`;
      }
      // State D: Standard (avg 140-180 AND TBR <= 4%)
      // Note: We use >= 140 to handle the boundary inclusive of 140 based on typical logic gaps,
      // but strictly following the "ELSE IF avg 140-180" logic usually means >= 140.
      else if (avg >= TIGHT_LIMIT) {
        priority = InsightPriority.INFO;
        note = `Your average glucose is ${u(avg, units)}. This is a solid result. You are keeping your average in a reasonable range while avoiding excessive lows.`;
      }
      // State E: Optimal (avg 70-140 AND TBR <= 4%)
      else {
        priority = InsightPriority.INFO;
        note = `Your average glucose is ${u(avg, units)}. This is fantastic! You have achieved a tight average while keeping your lows safely under control.`;
      }

      return {
        priority,
        note,
      };
    },
  };
}
