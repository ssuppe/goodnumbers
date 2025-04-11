// Export the interface
export { InsightGenerator } from './interfaces/insight-generator.interface';

// Export all generators
export { createLowPercentageInsight } from './generators/low-percentage.generator';
export { createGMIInsight } from './generators/gmi.generator';
export { createGMIvsTimeInRangeInsight } from './generators/gmi-vs-tir.generator';
export { createAvgGlucoseInsight } from './generators/avg-glucose.generator';
export { createTimeInRangeInsight } from './generators/time-in-range.generator';
export { createBasicStatsInsight, createBasicGMIStatsInsight } from './generators/basic-stats.generator';
