import { Insight } from '@goodnumbers/types';

export interface InsightGenerator {
  generate(): Insight;
}

export interface AnalysisResult {
  avgGlucose: number; // mg/dL
  lowPercentage: number; // 0-100
  highPercentage: number; // 0-100
  timeInRange: number; // 0-100
}
