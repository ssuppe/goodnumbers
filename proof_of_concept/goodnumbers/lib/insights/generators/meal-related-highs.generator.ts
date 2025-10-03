import { AssessmentInsight, InsightPriority } from '@/types/nightscout.d';
import { TimeCluster } from '../../events/time_clustering/time_clustering';
import { GlycemicEventType } from '../../events/detect_events';
import {
  ClassifiedEvent,
  EventClassificationType,
  DEFAULT_CLASSIFICATION_CONFIG,
} from '../../events/classification/classification_types';
import { InsightGenerator } from '../interfaces/insight-generator.interface';

/**
 * Creates a generator for meal-related high glucose insights
 * Analyzes TimeCluster data to identify patterns in meal-related hyperglycemia
 *
 * @param clusters - Array of TimeCluster objects from clusterGlycemicEvents
 * @returns An InsightGenerator for meal-related high glucose insights
 */
export function createMealRelatedHighsInsight(clusters: TimeCluster[]): InsightGenerator {
  // Immediately process the clusters to avoid reprocessing on each insight request
  const analysisResults = analyzeMealRelatedHighs(clusters);

  return {
    getAIInsight(): AssessmentInsight {
      // Return empty note if no analysis results available
      if (!analysisResults || !analysisResults.aiInsights || analysisResults.aiInsights.length === 0) {
        return {
          note: '',
          priority: InsightPriority.INFO,
        };
      }

      // Return the first AI insight (which is the summary insight)
      return analysisResults.aiInsights[0];
    },

    getUserInsight(): AssessmentInsight {
      // Return empty note if no analysis results available
      if (!analysisResults || !analysisResults.userInsights || analysisResults.userInsights.length === 0) {
        return {
          note: '',
          priority: InsightPriority.INFO,
        };
      }

      // Return the first user insight (which is the summary insight)
      return analysisResults.userInsights[0];
    },
  };
}

/**
 * Analyzes TimeCluster data to identify and generate insights about meal-related high glucose events
 *
 * @param clusters - Array of TimeCluster objects from clusterGlycemicEvents
 * @returns Object containing AI and user insights about meal-related patterns
 */
function analyzeMealRelatedHighs(clusters: TimeCluster[]): {
  aiInsights: AssessmentInsight[];
  userInsights: AssessmentInsight[];
} {
  try {
    // Log function entry (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('Starting mealRelatedHighs analysis', { clusterCount: clusters?.length ?? 0 });
    }

    // Validate input
    if (!clusters || !Array.isArray(clusters)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Invalid clusters input to mealRelatedHighs', { clusters });
      }
      return { aiInsights: [], userInsights: [] };
    }

    // Initialize counters with type safety
    let uncoveredMealCount = 0;
    let postbolusedMealCount = 0;
    let prebolusedMealCount = 0;
    let nonMealRelatedCount = 0;

    // Store event counts for reporting
    let totalHighs = 0;
    let totalMealRelatedHighs = 0;

    // Get the meal lookback window from the configuration
    const mealLookbackWindowHours = DEFAULT_CLASSIFICATION_CONFIG.mealLookbackWindowMinutes / 60;

    // Process each cluster
    for (const cluster of clusters) {
      try {
        // Type-check and only process clusters of HIGH or VERY_HIGH events
        if (!cluster) continue;

        if (cluster.eventType === GlycemicEventType.HIGH || cluster.eventType === GlycemicEventType.VERY_HIGH) {
          // For each event in the cluster, check its classifications
          if (!cluster.events || !Array.isArray(cluster.events)) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Invalid events array in cluster', { cluster });
            }
            continue;
          }

          for (const event of cluster.events) {
            if (!event) continue;

            totalHighs++;

            // Track if this event has any meal-related classifications
            let eventHasMealRelation = false;

            // Track individual classification types for this event
            let hasUncoveredMeal = false;
            let hasPostbolusedMeal = false;
            let hasPrebolusedMeal = false;

            // Safely check classifications with type guards
            if (event.hasOwnProperty('classifications') && Array.isArray((event as ClassifiedEvent).classifications)) {
              const classifiedEvent = event as ClassifiedEvent;

              for (const classification of classifiedEvent.classifications) {
                if (!classification || !classification.type) continue;

                // Track which classification types exist for this event
                switch (classification.type) {
                  case EventClassificationType.HIGH_AFTER_UNCOVERED_MEAL:
                    hasUncoveredMeal = true;
                    eventHasMealRelation = true;
                    break;
                  case EventClassificationType.HIGH_AFTER_POSTBOLUSED_MEAL:
                    hasPostbolusedMeal = true;
                    eventHasMealRelation = true;
                    break;
                  case EventClassificationType.HIGH_AFTER_PREBOLUSED_MEAL:
                    hasPrebolusedMeal = true;
                    eventHasMealRelation = true;
                    break;
                  default:
                    // Not a meal-related classification
                    break;
                }
              }

              // After checking all classifications, increment counters appropriately
              if (eventHasMealRelation) {
                // Only count each event once in the total
                totalMealRelatedHighs++;

                // Count each classification type separately
                if (hasUncoveredMeal) {
                  uncoveredMealCount++;
                }
                if (hasPostbolusedMeal) {
                  postbolusedMealCount++;
                }
                if (hasPrebolusedMeal) {
                  prebolusedMealCount++;
                }
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Event missing classifications property', { event });
              }
            }

            // If no meal-related classification was found, count as non-meal-related
            if (!eventHasMealRelation) {
              nonMealRelatedCount++;
            }
          }
        }
      } catch (clusterError) {
        // Handle errors for individual clusters to prevent entire function failure
        if (process.env.NODE_ENV === 'development') {
          console.error('Error processing cluster', { error: clusterError, cluster });
        }
        continue;
      }
    }

    // Log the counts for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Meal-related counts', {
        totalHighs,
        totalMealRelatedHighs,
        uncoveredMealCount,
        postbolusedMealCount,
        prebolusedMealCount,
        nonMealRelatedCount,
      });
    }

    // Safely handle the case with no high events
    if (totalHighs === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No high glucose events found in clusters');
      }
      return { aiInsights: [], userInsights: [] };
    }

    // Define return type with type safety
    const aiInsights: AssessmentInsight[] = [];
    const userInsights: AssessmentInsight[] = [];

    // Create a sorted array of classification types by count
    interface ClassificationCount {
      type: EventClassificationType | string;
      count: number;
    }

    const sortedClassifications: ClassificationCount[] = [
      { type: EventClassificationType.HIGH_AFTER_UNCOVERED_MEAL, count: uncoveredMealCount },
      { type: EventClassificationType.HIGH_AFTER_POSTBOLUSED_MEAL, count: postbolusedMealCount },
      { type: EventClassificationType.HIGH_AFTER_PREBOLUSED_MEAL, count: prebolusedMealCount },
      { type: 'NON_MEAL_RELATED', count: nonMealRelatedCount },
    ]
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    // Log sorted classifications
    if (process.env.NODE_ENV === 'development') {
      console.log('Sorted classifications', { sortedClassifications });
    }

    // Generate insights based on the pattern of meal-related highs
    if (totalMealRelatedHighs === 0) {
      // No meal-related highs found at all
      aiInsights.push({
        note: `No meal-related hyperglycemia was detected. No meals were found within ${mealLookbackWindowHours} hours before high glucose events, suggesting these elevations may be related to other factors such as basal rates, stress, or activity.`,
        priority: InsightPriority.IMPORTANT,
      });

      userInsights.push({
        note: `We didn't find any meals within ${mealLookbackWindowHours} hours before your high glucose events, so these don't appear to be meal related. Other factors like basal insulin rates, stress, or physical activity might be contributing.`,
        priority: InsightPriority.IMPORTANT,
      });
    } else if (totalMealRelatedHighs > 0 && totalMealRelatedHighs < totalHighs / 2) {
      // Some meal-related highs, but they're not the majority
      const percentMealRelated = Math.round((totalMealRelatedHighs / totalHighs) * 100);

      // AI insight for minority meal-related patterns
      aiInsights.push({
        note: `Only ${percentMealRelated}% of hyperglycemic events (${totalMealRelatedHighs} out of ${totalHighs}) appear to be meal-related. Although there were instances of post-meal hyperglycemia, the majority of high glucose events occurred without a preceding meal within the ${mealLookbackWindowHours}-hour window, suggesting other contributing factors should be investigated.`,
        priority: InsightPriority.IMPORTANT,
      });

      // User-friendly insight
      userInsights.push({
        note: `Although you had a few high glucose readings after meals (${totalMealRelatedHighs} times), this didn't happen most of the time. The majority of your high readings weren't connected to recent meals, which suggests other factors like basal insulin settings or lifestyle factors may be more significant.`,
        priority: InsightPriority.IMPORTANT,
      });
    } else {
      // Majority are meal-related highs
      const percentMealRelated = Math.round((totalMealRelatedHighs / totalHighs) * 100);

      // AI summary insight
      aiInsights.push({
        note: `${percentMealRelated}% of hyperglycemic events (${totalMealRelatedHighs} out of ${totalHighs}) appear to be meal-related, indicating significant opportunities for mealtime management improvements.`,
        priority: InsightPriority.IMPORTANT,
      });

      // User-friendly summary insight
      userInsights.push({
        note: `About ${percentMealRelated}% (${totalMealRelatedHighs} out of ${totalHighs}) of your high glucose readings appear to be related to meals.`,
        priority: InsightPriority.IMPORTANT,
      });
    }

    // Process each classification type in order of frequency
    for (const classification of sortedClassifications) {
      try {
        // Skip the non-meal-related classification as we already addressed it above
        if (classification.type === 'NON_MEAL_RELATED') continue;

        switch (classification.type) {
          case EventClassificationType.HIGH_AFTER_UNCOVERED_MEAL:
            // AI insight
            aiInsights.push({
              note: `Patient had ${classification.count} instances of hyperglycemia following meals with no insulin coverage. This represents a clear opportunity for intervention through meal bolus education.`,
              priority: InsightPriority.IMPORTANT,
            });

            // User insight
            userInsights.push({
              note: `You had ${classification.count} high readings after eating without taking insulin. Remember to take insulin before or with meals to help keep your glucose in range.`,
              priority: InsightPriority.IMPORTANT,
            });
            break;

          case EventClassificationType.HIGH_AFTER_POSTBOLUSED_MEAL:
            // AI insight
            aiInsights.push({
              note: `${classification.count} hyperglycemic events occurred after meals where insulin was given at or after mealtime. Delayed insulin administration may be contributing to post-meal glucose excursions.`,
              priority: InsightPriority.IMPORTANT,
            });

            // User insight
            userInsights.push({
              note: `You had ${classification.count} high readings after taking insulin at or after eating. Taking insulin 15-20 minutes before eating can help prevent these post-meal spikes.`,
              priority: InsightPriority.IMPORTANT,
            });
            break;

          case EventClassificationType.HIGH_AFTER_PREBOLUSED_MEAL:
            // AI insight
            aiInsights.push({
              note: `Patient experienced ${classification.count} hyperglycemic events despite proper pre-bolusing. This suggests insulin dose may be insufficient for carbohydrate intake or insulin:carb ratios need adjustment.`,
              priority: InsightPriority.IMPORTANT,
            });

            // User insight
            userInsights.push({
              note: `You had ${classification.count} high readings even though you took insulin before eating. This might mean your insulin doses need adjustment for the amount of carbs you're eating.`,
              priority: InsightPriority.IMPORTANT,
            });
            break;

          default:
            if (process.env.NODE_ENV === 'development') {
              console.warn('Unknown classification type encountered', { classificationType: classification.type });
            }
            break;
        }
      } catch (classificationError) {
        // Handle errors for individual classifications to prevent entire function failure
        if (process.env.NODE_ENV === 'development') {
          console.error('Error processing classification', {
            error: classificationError,
            classification,
          });
        }
        continue;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Generated insights', {
        aiInsightCount: aiInsights.length,
        userInsightCount: userInsights.length,
      });
    }

    return { aiInsights, userInsights };
  } catch (error) {
    // Catch-all error handler for the entire function
    if (process.env.NODE_ENV === 'development') {
      console.error('Error in mealRelatedHighs generator', { error });
    }
    // Return empty arrays in case of error to prevent cascading failures
    return { aiInsights: [], userInsights: [] };
  }
}
