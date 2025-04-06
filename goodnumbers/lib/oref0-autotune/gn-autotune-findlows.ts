// import { AutotunePreppedData } from 'gn-autotune-prep';
// import { MealEvent, TimeRangeAnalysis, TimeRangeAnalysisWithHours } from 'gn-meal-analysis';

// interface LowPatternAnalysis {
//   hour: number;
//   lowFrequency: number;
//   avgGlucose: number;
//   avgDeviation: number;
//   totalReadings: number;
//   daysWithLows: number;

//   typicalIOB: number;
//   basalIOB: number;
//   bolusIOB: number;

//   basalData: {
//     count: number;
//     avgDeviation: number;
//   };
//   isfData: {
//     count: number;
//     avgDeviation: number;
//   };
//   mealData: {
//     count: number;
//     avgDeviation: number;
//     avgTimeFromMeal: number;
//   };

//   primaryCause: 'basal' | 'isf' | 'meal' | 'unknown';
//   confidence: 'high' | 'medium' | 'low';
//   reasoning: string[];
//   recommendations: string[];
// }

// function findCommonLowTimes(
//   prepped_glucose: AutotunePreppedData,
//   meal_events: MealEvent[],
//   tod_analysis: TimeRangeAnalysisWithHours,
// ): LowPatternAnalysis[] {
//   // Constants from autotune's logic
//   const LOW_THRESHOLD = 70;
//   const SIGNIFICANT_DEVIATION = 20; // mg/dL, from autotune
//   const FREQUENT_LOW_THRESHOLD = 0.15; // 15% of readings = frequent
//   const MIN_READINGS_FOR_CONFIDENCE = 10;

//   const lowPatterns: LowPatternAnalysis[] = [];

//   // Analyze each hour
//   for (let hour = 0; hour < 24; hour++) {
//     const hourData: TimeRangeAnalysis = tod_analysis.hours[hour];

//     // Skip hours with too few readings
//     if (hourData.numReadings < MIN_READINGS_FOR_CONFIDENCE) {
//       continue;
//     }

//     // Only analyze hours with significant lows
//     if (hourData.lowPercentage >= FREQUENT_LOW_THRESHOLD * 100) {
//       // Initialize analysis for this hour
//       const analysis: LowPatternAnalysis = {
//         hour,
//         lowFrequency: hourData.lowPercentage / 100,
//         avgGlucose: hourData.avgGlucose,
//         avgDeviation: hourData.avgDeviation,
//         totalReadings: hourData.numReadings,
//         daysWithLows: 0,
//         typicalIOB: 0,
//         basalIOB: 0,
//         bolusIOB: 0,
//         basalData: { count: 0, avgDeviation: 0 },
//         isfData: { count: 0, avgDeviation: 0 },
//         mealData: { count: 0, avgDeviation: 0, avgTimeFromMeal: 0 },
//         primaryCause: 'unknown',
//         confidence: 'low',
//         reasoning: [],
//         recommendations: [],
//       };

//       // Count distinct days with lows this hour
//       const daysWithLows = new Set(
//         prepped_glucose.basalGlucoseData
//           .concat(prepped_glucose.ISFGlucoseData)
//           .concat(prepped_glucose.CSFGlucoseData)
//           .filter((reading) => {
//             const readingHour = new Date(reading.date).getHours();
//             const isLow = reading.glucose < LOW_THRESHOLD;
//             return readingHour === hour && isLow;
//           })
//           .map((reading) => new Date(reading.date).toISOString().split('T')[0]),
//       );
//       analysis.daysWithLows = daysWithLows.size;

//       // Analyze basal-related lows
//       const basalReadings = prepped_glucose.basalGlucoseData.filter((reading) => {
//         const readingHour = new Date(reading.date).getHours();
//         return readingHour === hour && reading.glucose < LOW_THRESHOLD;
//       });

//       if (basalReadings.length > 0) {
//         analysis.basalData.count = basalReadings.length;
//         analysis.basalData.avgDeviation =
//           basalReadings.reduce((sum, reading) => sum + Number(reading.deviation), 0) / basalReadings.length;
//       }

//       // Analyze ISF-related lows
//       const isfReadings = prepped_glucose.ISFGlucoseData.filter((reading) => {
//         const readingHour = new Date(reading.date).getHours();
//         return readingHour === hour && reading.glucose < LOW_THRESHOLD;
//       });

//       if (isfReadings.length > 0) {
//         analysis.isfData.count = isfReadings.length;
//         analysis.isfData.avgDeviation =
//           isfReadings.reduce((sum, reading) => sum + Number(reading.deviation), 0) / isfReadings.length;
//       }

//       // Analyze meal-related lows
//       const mealReadings = prepped_glucose.CSFGlucoseData.filter((reading) => {
//         const readingHour = new Date(reading.date).getHours();
//         return readingHour === hour && reading.glucose < LOW_THRESHOLD;
//       });

//       if (mealReadings.length > 0) {
//         analysis.mealData.count = mealReadings.length;
//         analysis.mealData.avgDeviation =
//           mealReadings.reduce((sum, reading) => sum + Number(reading.deviation), 0) / mealReadings.length;

//         // Calculate average time from last meal start
//         const mealTimes = mealReadings
//           .map((reading) => {
//             const readingTime = new Date(reading.date);
//             const lastMeal = meal_events
//               .filter((meal) => new Date(meal.startTime) <= readingTime)
//               .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

//             return lastMeal ? (readingTime.getTime() - new Date(lastMeal.startTime).getTime()) / (1000 * 60) : null;
//           })
//           .filter((time): time is number => time !== null);

//         if (mealTimes.length > 0) {
//           analysis.mealData.avgTimeFromMeal = mealTimes.reduce((sum, time) => sum + time, 0) / mealTimes.length;
//         }
//       }

//       // Determine primary cause and confidence
//       let maxCount = Math.max(analysis.basalData.count, analysis.isfData.count, analysis.mealData.count);

//       if (analysis.basalData.count === maxCount && Math.abs(analysis.basalData.avgDeviation) > SIGNIFICANT_DEVIATION) {
//         analysis.primaryCause = 'basal';
//         analysis.reasoning.push(
//           `${analysis.basalData.count} lows during basal periods with average deviation of ${analysis.basalData.avgDeviation.toFixed(1)}`,
//         );
//         analysis.recommendations.push('Consider reducing basal rate 2-3 hours before this time');
//       } else if (
//         analysis.isfData.count === maxCount &&
//         Math.abs(analysis.isfData.avgDeviation) > SIGNIFICANT_DEVIATION
//       ) {
//         analysis.primaryCause = 'isf';
//         analysis.reasoning.push(
//           `${analysis.isfData.count} lows during ISF periods with average deviation of ${analysis.isfData.avgDeviation.toFixed(1)}`,
//         );
//         analysis.recommendations.push('Consider increasing ISF (reducing insulin sensitivity)');
//       } else if (analysis.mealData.count === maxCount) {
//         analysis.primaryCause = 'meal';
//         analysis.reasoning.push(
//           `${analysis.mealData.count} lows following meals, typically ${analysis.mealData.avgTimeFromMeal.toFixed(0)} minutes after eating`,
//         );
//         analysis.recommendations.push('Review carb ratio and meal bolus timing');
//       }

//       // Set confidence level
//       if (analysis.daysWithLows >= 3 && Math.abs(analysis.avgDeviation) > SIGNIFICANT_DEVIATION) {
//         analysis.confidence = 'high';
//         analysis.reasoning.push(`Pattern occurs on ${analysis.daysWithLows} different days with significant deviation`);
//       } else if (analysis.daysWithLows >= 2) {
//         analysis.confidence = 'medium';
//         analysis.reasoning.push(`Pattern occurs on ${analysis.daysWithLows} different days`);
//       }

//       lowPatterns.push(analysis);
//     }
//   }

//   return lowPatterns;
// }

// export { findCommonLowTimes, type LowPatternAnalysis };
