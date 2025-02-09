import {
  AssessmentInsight,
  filterCriticalInsights,
  GlucoseUnits,
  hasCriticalInsights,
  InsightPriority,
} from '../types/nightscout';
import { GLUCOSE_RANGES } from './gn-constants';
import { AnalysisResult, analyzeTimeOfDay, AutotunePreppedData, FullAnalysisResult } from './gn-meal-analysis';
import { u } from '../utils/text';

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

function getLowPercentageInsight(compositeday_analysis: AnalysisResult): AssessmentInsight {
  let insight: AssessmentInsight;
  let note: string = '';
  note += `Medical professionals agree that diabetics should spend less than 4% of the time low. You're spending ${Math.round(compositeday_analysis.lowPercentage)}% of the time low. `;

  switch (true) {
    case compositeday_analysis.lowPercentage <= 3:
      note += `This is quite good - you're well below the clinical recommendation. Staying in non-diabetic target while keeping your lows down is quite an accomplishment. Keep doing what you're doing.`;
      insight = { note: note, priority: InsightPriority.IMPORTANT };

      break;
    case compositeday_analysis.lowPercentage <= 4:
      note += `This is quite good - you're below the clinical recommendation of 4%. However, you are pretty close to it. Keep an eye on this and aim to improve it next week. `;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;
    case compositeday_analysis.lowPercentage < 10:
      note += `This is quite high and this should be one of the first things you try to improve. Spending anywhere near 10% in hypoglycemia is considered significant and requires medical attention. `;
      insight = { note: note, priority: InsightPriority.SERIOUS };
      break;
    default:
      note += `Your time spent in hypoglycemia, or low blood sugar, is quite high. Clinical best practices say anything higher than 10%  is a severe, critical risk to your health and may require emergency intervention. We cannot continue until you improve this.`;
      insight = { note: note, priority: InsightPriority.CRITICAL };
      break;
  }
  return insight;
}

function getTIRInsight(
  compositeday_analysis: AnalysisResult,
  preferred_units: GlucoseUnits,
  num_days: number,
): AssessmentInsight {
  let insight: AssessmentInsight;
  let note: string = '';
  note += `Medical professionals agree that diabetics should be between ${u(70, preferred_units)} and ${u(180, preferred_units)} 70% of the time. You spent this week in range ${compositeday_analysis.inRangePercentage}% of the time, or about ${Math.round(compositeday_analysis.inRangePercentage / 100) * num_days} days.`;

  switch (true) {
    case compositeday_analysis.inRangePercentage <= 50:
      note += `Your blood sugars are spending a significant amount of time outside the target range. This increases your risk of long-term complications, and indicates you need to talk to a medical professional about your insulin regime, diet, and other approaches.`;
      insight = { note: note, priority: InsightPriority.IMPORTANT };

      break;
    case compositeday_analysis.inRangePercentage > 50 && compositeday_analysis.inRangePercentage <= 60:
      note += `Your Time in Range is OK but not great, but we still have some work to do to reach our goal of over 70%. You are still at risk of long-term complications, and should speak to a medical professional about how to improve your insulin regime, diet and other appraoches `;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;
    case compositeday_analysis.inRangePercentage > 60 && compositeday_analysis.inRangePercentage <= 70:
      note += `You're getting closer to the target! Your Time in Range is now in the 60-70% range, which is good progress. We're aiming for over 70%, so let's see if we can fine-tune things a bit more.`;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;
    case compositeday_analysis.inRangePercentage > 70 && compositeday_analysis.inRangePercentage <= 80:
      note += `Congratulations! You've reached our Time in Range goal of over 70%. This is a great accomplishment and shows your hard work is paying off. `;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;
    case compositeday_analysis.inRangePercentage > 80 && compositeday_analysis.inRangePercentage <= 90:
      note += `Your blood sugar control is excellent! You're spending a very high percentage of time in range. This significantly reduces your risk of long-term complications. `;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;

    default:
      note += `Your blood sugar control is outstanding! You're spending almost all of your time in range. This is truly remarkable. While this level of control is impressive, we need to be very careful about low blood sugars. Also, you should consider if this is causing you a lot of stress, anxiety or burnout.`;
      insight = { note: note, priority: InsightPriority.IMPORTANT };
      break;
  }
  return insight;
}

export function getWeekOverview(
  compositeday_analysis: AnalysisResult,
  numDays: number,
  preferred_units: GlucoseUnits,
  patient_range: PatientRange,
): AssessmentInsight[] {
  const insights: AssessmentInsight[] = [];

  insights.push({
    note: `  * This week was the patient's average blood glucose was ${u(compositeday_analysis.avgGlucose, preferred_units)}\n`,
    priority: InsightPriority.ALWAYS_INCLUDE,
  });

  /////////////////////////////////////////////////////////////////////////////
  // Average, based on absolute recommendations (not patient relative ones)
  ////////////////////////////////////////////////////////////////////////////
  if (compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.LOW) {
    let note = `* Your average glucose is below normal range, which means you're spending most of your time in hypoglycemia. In fact, you're spending ${compositeday_analysis.lowPercentage}% of the time in hypoglycemia. This can cause seizures, loss of consciousness, cognitive impairment and even death. This requires urgent medical attention. You must speak to your doctor immediately about how to raise your average blood glucose. We cannot go on, we must inform the patient ASAP.`;

    insights.push({ note: note, priority: InsightPriority.CRITICAL });
    insights.push(getLowPercentageInsight(compositeday_analysis));
  } else if (
    compositeday_analysis.avgGlucose < GLUCOSE_RANGES.TARGET_BOTTOM &&
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW
  ) {
    let note = `* Your average glucose is bordering dangerously low, between ${u(GLUCOSE_RANGES.LOW, (preferred_units = preferred_units))} and ${u(GLUCOSE_RANGES.TARGET_BOTTOM, (preferred_units = preferred_units))}. You may be thinking having a lower blood glucose is keeping you healthy, but you are more likely to have hypoglycemic episodes, which are incredibly dangerous, and can cause seizures, loss of consciousness, cognitive impairment and even death. In fact, you're spending ${compositeday_analysis.lowPercentage}% of the time in hypoglycemia. This requires urgent medical attention. You must speak to your doctor immediately about how to raise your average blood glucose. We cannot go on, we must inform the patient ASAP.`;

    insights.push({ note: note, priority: InsightPriority.CRITICAL });
    insights.push(getLowPercentageInsight(compositeday_analysis));
  } else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.TARGET_BOTTOM &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TARGET_TOP
  ) {
    let note = `* Your average glucose is within a non-diabetic range of ${u(GLUCOSE_RANGES.TARGET_BOTTOM, preferred_units)} and ${u(GLUCOSE_RANGES.TARGET_TOP, preferred_units)}. This is a great accomplishment, but may not tell us the full picture. We need to understand how much time you're spending high and low to understand what's happening.\n`;
    insights.push({ note: note, priority: InsightPriority.IMPORTANT });
    insights.push(getLowPercentageInsight(compositeday_analysis));
  } else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.TITR_HIGH
  ) {
    let note = `* Your average glucose is close to a nearly non-diabetic range, or what we call "in tight range", between ${u(GLUCOSE_RANGES.LOW)} and ${u(GLUCOSE_RANGES.TITR_HIGH)}.\n\nTime in tight range describes the time an individual spends in normal levels of blood glucose.`;
    insights.push({ note: note, priority: InsightPriority.IMPORTANT });
    insights.push(getLowPercentageInsight(compositeday_analysis));
  } else if (
    compositeday_analysis.avgGlucose >= GLUCOSE_RANGES.LOW &&
    compositeday_analysis.avgGlucose <= GLUCOSE_RANGES.HIGH
  ) {
    let note = `* Your average glucose is within the recommended range below ${u(180, preferred_units)}.\n`;
    insights.push({ note: note, priority: InsightPriority.IMPORTANT });

    insights.push(getLowPercentageInsight(compositeday_analysis));
  } else {
    let note =
      '* Your glucose levels suggest your diabetes may need attention. Please schedule a consultation with your healthcare provider to discuss adjusting your management plan.\n';
    insights.push({ note: note, priority: InsightPriority.IMPORTANT });
    insights.push(getLowPercentageInsight(compositeday_analysis));
  }

  /////////////////////////////////////////////////////////////////////////////
  // If there are any critical insights, let's quit now. We are unable to
  // continue as the patient as severe issues.
  ////////////////////////////////////////////////////////////////////////////
  if (hasCriticalInsights(insights)) {
    return filterCriticalInsights(insights)!;
  }
  ////////////////////////////////////////////////////////////////////////////
  // Cover standard TIR evaluation to baseline everyone
  ////////////////////////////////////////////////////////////////////////////
  let note = '';

  /////////////////////////////////////////////////////////////////////////////
  // Establish patient relative range
  /////////////////////////////////////////////////////////////////////////////
  note = `Before we go further, we are going to set improvement goals that make sense for where you blood sugar numbers are right now. Because your average is ${patient_range.average_name}, we are going to consider anything above ${patient_range.target_high} to be high. `;

  if (patient_range.target_high != patient_range.very_high) {
    note += `And we'll consider ${patient_range.very_high} to be very high.\n\n`;
  }
  insights.push({ note: note, priority: InsightPriority.ALWAYS_INCLUDE });

  /////////////////////////////////////////////////////////////////////////////
  // Time in range
  /////////////////////////////////////////////////////////////////////////////
  // notes +=
  //   '  * We need to look at time in range. Aververage glucose, diabetics need to have a lot of time in range, and ideally slow changes in rising and falling blood sugars. These are good indicators of diabetes control and whether the patient may need to overreact to changes.\n';

  // notes += `  * The patient's time in range is ${Math.round(compositeday_analysis.inRangePercentage)}%.`;
  // notes += `  * Practically speaking, the patient spent ${Math.round((compositeday_analysis.inRangePercentage / 100.0) * numDays)} days of the last ${numDays} in range.`;
  // if (Math.round(compositeday_analysis.inRangePercentage) < 50) {
  //   notes +=
  //     "    * This TIR indicates significant glucose variability and puts you at a higher risk for both short-term and long-term complications. We need to identify the underlying causes of these fluctuations. Let's review your insulin regimen, medication adherence, diet, exercise habits, and any other factors that might be contributing to these swings. It’s crucial we work together to improve this to at least 70%, the minimum recommended by the American Diabetes Association (ADA) (1).\n";
  // } else if (
  //   Math.round(compositeday_analysis.inRangePercentage) >= 50 &&
  //   Math.round(compositeday_analysis.inRangePercentage) < 60
  // ) {
  //   notes +=
  //     "    * Your Time in Range is showing some improvement, but we're still below the recommended target of 70% and need to make more progress to reduce your risk of complications. A TIR between 50-60% suggests that your glucose levels are fluctuating significantly, and we need to understand why. Let's carefully review your current diabetes management plan, including your insulin regimen, medication adherence, meal patterns, exercise habits, and stress levels. We may need to adjust your insulin doses, refine your carbohydrate counting, or explore other strategies to stabilize your glucose levels and increase your time spent in the target range. We'll work together to identify any patterns in your CGM data and make personalized adjustments to help you reach that 70% goal and improve your overall diabetes management.";
  // } else if (
  //   Math.round(compositeday_analysis.inRangePercentage) >= 60 &&
  //   Math.round(compositeday_analysis.inRangePercentage) < 70
  // ) {
  //   notes +=
  //     "    * Your TIR is improving, but it's still below the recommended target of 70%. While this is a step in the right direction, we want to aim higher. Let's fine-tune your current management plan. We can discuss strategies like adjusting your basal insulin, refining your carb counting and bolusing, or incorporating more frequent blood glucose monitoring to identify trends and make necessary adjustments. International consensus guidelines recommend aiming for at least 70%";
  // } else if (
  //   Math.round(compositeday_analysis.inRangePercentage) >= 70 &&
  //   Math.round(compositeday_analysis.inRangePercentage) < 80
  // ) {
  //   notes +=
  //     "    * Great job! You've reached the recommended TIR target of 70%, which significantly reduces your risk of complications. However, we can still strive for further improvement. Let’s analyze your CGM data for patterns and identify any remaining areas of variability. Even small improvements can make a big difference in your long-term health.";
  // } else if (
  //   Math.round(compositeday_analysis.inRangePercentage) >= 80 &&
  //   Math.round(compositeday_analysis.inRangePercentage) < 90
  // ) {
  //   notes +=
  //     "    * Excellent work! Your TIR is fantastic and demonstrates excellent glucose control. This level of control significantly minimizes your risk of long-term complications. Let's maintain this momentum. We'll continue to monitor your data and make any necessary adjustments to ensure you stay within this optimal range. Be mindful of potential burnout and ensure your diabetes management plan is sustainable.";
  // } else if (Math.round(compositeday_analysis.inRangePercentage) >= 90) {
  //   notes +=
  //     "    * This is outstanding! Your TIR is truly exceptional. However, we need to be cautious about potential overtreatment and the risk of hypoglycemia. Let's review your data for any signs of frequent or severe low glucose events. Maintaining this level of control long-term requires vigilance, but remember to prioritize safety and avoid aggressive targets that might increase hypoglycemia risk. It's essential to find a balance between excellent control and a safe, sustainable approach.";
  // }

  // notes += `  * Time spent HIGH (> ${u(GLUCOSE_RANGES.HIGH, preferred_units)}) is ${Math.round(compositeday_analysis.highPercentage)}%`;

  // if (Math.round(compositeday_analysis.highPercentage) < 3) {
  //   notes +=
  //     "    * Excellent! Your time spent above target is minimal, indicating good glucose control. Let's aim to maintain this while also optimizing your time in range.";
  // } else if (
  //   Math.round(compositeday_analysis.highPercentage) >= 3 &&
  //   Math.round(compositeday_analysis.highPercentage) < 5
  // ) {
  //   notes +=
  //     "    * Good. Your time spent above target is slightly elevated.  Let's examine your CGM data to identify patterns and potential causes for these highs. We may need to make small adjustments to your insulin regimen, meal plan, or exercise routine.  We'll work together to fine-tune your approach while maintaining a balance to avoid lows.";
  // } else if (
  //   Math.round(compositeday_analysis.highPercentage) >= 5 &&
  //   Math.round(compositeday_analysis.highPercentage) < 7
  // ) {
  //   notes +=
  //     "    * Your time spent above target is moderately high. This could increase your risk of long-term complications.  Let's review your CGM data in detail. We may need to adjust your insulin doses, particularly your bolus insulin or correction factors, or refine your carbohydrate counting.  We’ll also consider other factors that might be contributing to these highs, such as stress or illness.";
  // } else if (
  //   Math.round(compositeday_analysis.highPercentage) >= 7 &&
  //   Math.round(compositeday_analysis.highPercentage) < 10
  // ) {
  //   notes +=
  //     "    * Your time spent above target is getting high and needs to be addressed to minimize long-term risks. Let’s review your insulin regimen, medication adherence, meal timings and composition, and exercise routine to pinpoint contributing factors.  We'll likely need to adjust your insulin doses or explore other management strategies.";
  // } else if (Math.round(compositeday_analysis.highPercentage) >= 10) {
  //   notes +=
  //     "    * Your time spent above target is too high and significantly increases your risk of long-term complications. This requires closer attention.  We need to carefully review your current management plan, including your basal and bolus insulin doses, carbohydrate ratios, and correction factors. We'll also consider additional factors that may be influencing your glucose levels, such as stress, illness, or medications. It's important to address this promptly to protect your long-term health.";
  // }
  return insights;
}
