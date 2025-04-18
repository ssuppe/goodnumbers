// import { ATReading } from 'gn-autotune-prep';

// import { ATReading } from 'gn-autotune-prep';
import { ATReading } from '../gn-autotune-prep';
import { TimeCluster } from './gn-dawn-phenom';

// // Types for the segments of a dawn pattern
// export interface DawnPatternSegment {
//   startTime: Date;
//   endTime: Date;
//   readings: ATReading[];
//   riseRate: number;
//   isMealRelated: boolean;
//   mealInfo?: {
//     carbsConsumed?: Number;
//     absorptionEnd?: Date;
//     priorMealTime?: Date;
//     mealTime?: Date;
//     estimatedAbsorptionEnd?: Date;
//   };
// }

// // Enhanced DawnPatternDay to include meal context
// export interface DawnPatternDay {
//   date: string;
//   startTime: Date;
//   startGlucose: number;
//   peakGlucose: number;
//   timeOfPeak: Date;
//   averageDeviation: number;
//   totalDeviation: number;
//   duration: number;
//   averageBGI: number;
//   confidence: number;
//   mealsPresent?: boolean;

//   // New fields for improved analysis
//   cleanSegmentStartTime: Date; // When meal effects ended
//   hasPriorMealEffect: boolean; // Whether evening meal affected start
//   mealAbsorptionEndTime?: Date; // When meal absorption completed
//   riseRate: number; // Rate during clean segment

//   // Analysis segments
//   mealSegment?: DawnPatternSegment;
//   dawnSegment: DawnPatternSegment;
// }

// // Analysis characteristics
// export interface RiseCharacteristics {
//   riseRate: number;
//   duration: number;
//   totalRise: number;
//   averageBGI: number;
//   priorInsulinActivity: number;
//   segments: DawnPatternSegment[];
//   hasPriorMealEffect: boolean;
//   cleanSegmentStartTime: Date;
// }

export interface MorningRise {
  startTime: Date;
  endTime: Date;
  startGlucose: number;
  endGlucose: number;
  duration: number; // minutes
  riseRate: number; // mg/dL per minute
  readings: ATReading[];
}

export interface RiseWithCarbs extends MorningRise {
  carbAmount: number;
  carbTime: Date;
}

export interface RiseAfterLow extends MorningRise {
  lowGlucose: number;
  lowTime: Date;
}

export interface CleanRise extends MorningRise {
  // No additional fields needed, but separate type for clarity
}

export interface MorningRiseAnalysis {
  // Categorized rises
  risesWithCarbs: RiseWithCarbs[];
  risesAfterLows: RiseAfterLow[];
  cleanRises: CleanRise[];

  // Summary stats for clean rises
  averageCleanRiseRate?: number;
  typicalStartTime?: string;
  startTimeClusters?: TimeCluster[];
  daysAnalyzed: number;
}
