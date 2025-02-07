import { GlucoseUnits } from '../../types/nightscout';
import { GLUCOSE_RANGES } from './gn-constants';
import { AnalysisResult, analyzeTimeOfDay, AutotunePreppedData, FullAnalysisResult } from './gn-meal-analysis';
import { u } from '../../utils/text';

export function getWeekOverview(
  all_prepped_glucose: AutotunePreppedData,
  firstDate: string,
  endDate: string,
  numDays: number,
  preferred_units: GlucoseUnits,
) {
  var notes = '';
  const full_analysis: FullAnalysisResult = analyzeTimeOfDay(all_prepped_glucose);
  const tod_analysis: AnalysisResult = full_analysis.overall;

  notes += `# Patient notes: ${firstDate} to ${endDate}\n`;
  notes += `Please note: The patient's preferred blood glucose units are ${preferred_units}\n`;
  notes += '\n';
  notes += '## Weekly overview\n\n';
  notes += `  * This week was the patient's average blood glucose was ${u(tod_analysis.avgGlucose, preferred_units)}\n`;

  /////////////////////////////////////////////////////////////////////////////
  // Average
  ////////////////////////////////////////////////////////////////////////////
  if (tod_analysis.avgGlucose >= GLUCOSE_RANGES.TARGET_BOTTOM && tod_analysis.avgGlucose <= GLUCOSE_RANGES.TARGET_TOP) {
    notes += '    * EXCELLENT control! Your average glucose is within your target range. This is a great sign!\n';
  } else if (tod_analysis.avgGlucose >= GLUCOSE_RANGES.LOW && tod_analysis.avgGlucose <= GLUCOSE_RANGES.TITR_HIGH) {
    notes +=
      '    * VERY GOOD control! Your average glucose is close to target range, or what we call "in tight range, showing strong diabetes management.\n';
  } else if (tod_analysis.avgGlucose >= GLUCOSE_RANGES.LOW && tod_analysis.avgGlucose <= GLUCOSE_RANGES.HIGH) {
    notes += `    * GOOD job! While there's room for improvement, you should be proud of maintaining your average glucose below ${u(180, preferred_units)}.\n`;
  } else {
    notes +=
      '    * Your glucose levels suggest your diabetes may need attention. Please schedule a consultation with your healthcare provider to discuss adjusting your management plan.\n';
  }

  /////////////////////////////////////////////////////////////////////////////
  // Time in range and variability
  ////////////////////////////////////////////////////////////////////////////
  notes +=
    '  * We need to look at time in range and variability. In addition to a target average glucose, diabetics need to have a lot of time in range, and ideally slow changes in rising and falling blood sugars. These are good indicators of diabetes control and whether the patient may need to overreact to changes.\n';

  notes += `  * The patient's time in range is ${Math.round(tod_analysis.inRangePercentage)}%.`;
  notes += `  * Practically speaking, the patient spent ${Math.round((tod_analysis.inRangePercentage / 100.0) * numDays)} days of the last ${numDays} in range.`;
  if (Math.round(tod_analysis.inRangePercentage) < 50) {
    notes +=
      "    * This TIR indicates significant glucose variability and puts you at a higher risk for both short-term and long-term complications. We need to identify the underlying causes of these fluctuations. Let's review your insulin regimen, medication adherence, diet, exercise habits, and any other factors that might be contributing to these swings. It’s crucial we work together to improve this to at least 70%, the minimum recommended by the American Diabetes Association (ADA) (1).\n";
  } else if (Math.round(tod_analysis.inRangePercentage) >= 50 && Math.round(tod_analysis.inRangePercentage) < 60) {
    notes +=
      "    * Your Time in Range is showing some improvement, but we're still below the recommended target of 70% and need to make more progress to reduce your risk of complications. A TIR between 50-60% suggests that your glucose levels are fluctuating significantly, and we need to understand why. Let's carefully review your current diabetes management plan, including your insulin regimen, medication adherence, meal patterns, exercise habits, and stress levels. We may need to adjust your insulin doses, refine your carbohydrate counting, or explore other strategies to stabilize your glucose levels and increase your time spent in the target range. We'll work together to identify any patterns in your CGM data and make personalized adjustments to help you reach that 70% goal and improve your overall diabetes management.";
  } else if (Math.round(tod_analysis.inRangePercentage) >= 60 && Math.round(tod_analysis.inRangePercentage) < 70) {
    notes +=
      "    * Your TIR is improving, but it's still below the recommended target of 70%. While this is a step in the right direction, we want to aim higher. Let's fine-tune your current management plan. We can discuss strategies like adjusting your basal insulin, refining your carb counting and bolusing, or incorporating more frequent blood glucose monitoring to identify trends and make necessary adjustments. International consensus guidelines recommend aiming for at least 70%";
  } else if (Math.round(tod_analysis.inRangePercentage) >= 70 && Math.round(tod_analysis.inRangePercentage) < 80) {
    notes +=
      "    * Great job! You've reached the recommended TIR target of 70%, which significantly reduces your risk of complications. However, we can still strive for further improvement. Let’s analyze your CGM data for patterns and identify any remaining areas of variability. Even small improvements can make a big difference in your long-term health.";
  } else if (Math.round(tod_analysis.inRangePercentage) >= 80 && Math.round(tod_analysis.inRangePercentage) < 90) {
    notes +=
      "    * Excellent work! Your TIR is fantastic and demonstrates excellent glucose control. This level of control significantly minimizes your risk of long-term complications. Let's maintain this momentum. We'll continue to monitor your data and make any necessary adjustments to ensure you stay within this optimal range. Be mindful of potential burnout and ensure your diabetes management plan is sustainable.";
  } else if (Math.round(tod_analysis.inRangePercentage) >= 90) {
    notes +=
      "    * This is outstanding! Your TIR is truly exceptional. However, we need to be cautious about potential overtreatment and the risk of hypoglycemia. Let's review your data for any signs of frequent or severe low glucose events. Maintaining this level of control long-term requires vigilance, but remember to prioritize safety and avoid aggressive targets that might increase hypoglycemia risk. It's essential to find a balance between excellent control and a safe, sustainable approach.";
  }

  notes += `  * Time spent LOW (< ${u(GLUCOSE_RANGES.LOW, preferred_units)}) is ${Math.round(tod_analysis.lowPercentage)}%`;
  if (Math.round(tod_analysis.lowPercentage) <= 1) {
    notes += `    * Excellent! Your time spent below ${u(70, preferred_units)} is very low, which minimizes your risk of hypoglycemia. This suggests a good balance between glucose control and avoiding lows. Let's aim to maintain this while also optimizing your time in range.`;
  } else if (Math.round(tod_analysis.lowPercentage) >= 1 && Math.round(tod_analysis.lowPercentage) < 3) {
    notes += `    * Good. Your time spent below ${u(70, preferred_units)} is within an acceptable range. While a small amount of time below range isn't typically cause for immediate concern, we want to be vigilant and ensure it doesn't increase. We’ll continue to monitor this closely, and we can discuss strategies to further reduce your risk if necessary while striving for a higher time in range.`;
  } else if (Math.round(tod_analysis.lowPercentage) >= 3 && Math.round(tod_analysis.lowPercentage) < 4) {
    notes += `    * Your time spent below ${u(70, preferred_units)} is approaching the higher end of the acceptable range. Let’s analyze your CGM data to understand when these lows are occurring and identify any patterns. We may need to make small adjustments to your insulin regimen or meal plan to minimize these events while still aiming for optimal glucose control. This is bordering on the threshold for increased risk, according to the International Consensus on Time in Range (Battelino et al., 2019).`;
  } else if (Math.round(tod_analysis.lowPercentage) >= 4 && Math.round(tod_analysis.lowPercentage) < 5) {
    notes += `    * Your time below ${u(70, preferred_units)} is now above the recommended threshold. This indicates a slightly elevated risk of hypoglycemia. It's important to address this to prevent potential complications. Let’s review your insulin doses, particularly your basal and bolus insulin, and discuss strategies like adjusting your carb ratios or pre-bolusing to reduce your risk of lows. It's crucial we work together to find a balance between achieving good glucose control and minimizing hypoglycemia. The 4% threshold is based on the work of Battelino et al. (2019), where higher percentages are associated with increased hypoglycemia risk.`;
  } else if (Math.round(tod_analysis.lowPercentage) >= 5 && Math.round(tod_analysis.lowPercentage) < 10) {
    notes += `    * Your time spent below ${u(70, preferred_units)} is too high and puts you at significant risk for hypoglycemia. We need to take action to reduce this immediately. Let's carefully review your insulin regimen, meal plan, and exercise routine to identify potential triggers for these low glucose events. We might need to reduce your insulin doses or adjust your carbohydrate intake. We also need to discuss hypoglycemia awareness and ensure you have a plan for treating low blood sugar. This level warrants careful consideration and potentially more significant adjustments to therapy.`;
  } else if (Math.round(tod_analysis.lowPercentage) >= 10) {
    notes += `    * Your time spent below ${u(70, preferred_units)} is far too high and indicates a serious risk of severe hypoglycemia. This requires immediate attention. We need to adjust your insulin regimen right away, likely by reducing your doses. Let's also discuss potential causes for these frequent lows, such as changes in your activity level, medication interactions, or alcohol consumption. We need to develop a comprehensive plan to address this and protect you from the dangers of severe hypoglycemia. It’s also important to review your hypoglycemia awareness and ensure you have glucagon on hand and know how to use it.” This level requires urgent action to prevent severe hypoglycemia and potential harm.`;
  }

  notes += `  * Time spent HIGH (> ${u(GLUCOSE_RANGES.HIGH, preferred_units)}) is ${Math.round(tod_analysis.highPercentage)}%`;

  if (Math.round(tod_analysis.highPercentage) < 3) {
    notes +=
      "    * Excellent! Your time spent above target is minimal, indicating good glucose control. Let's aim to maintain this while also optimizing your time in range.";
  } else if (Math.round(tod_analysis.highPercentage) >= 3 && Math.round(tod_analysis.highPercentage) < 5) {
    notes +=
      "    * Good. Your time spent above target is slightly elevated.  Let's examine your CGM data to identify patterns and potential causes for these highs. We may need to make small adjustments to your insulin regimen, meal plan, or exercise routine.  We'll work together to fine-tune your approach while maintaining a balance to avoid lows.";
  } else if (Math.round(tod_analysis.highPercentage) >= 5 && Math.round(tod_analysis.highPercentage) < 7) {
    notes +=
      "    * Your time spent above target is moderately high. This could increase your risk of long-term complications.  Let's review your CGM data in detail. We may need to adjust your insulin doses, particularly your bolus insulin or correction factors, or refine your carbohydrate counting.  We’ll also consider other factors that might be contributing to these highs, such as stress or illness.";
  } else if (Math.round(tod_analysis.highPercentage) >= 7 && Math.round(tod_analysis.highPercentage) < 10) {
    notes +=
      "    * Your time spent above target is getting high and needs to be addressed to minimize long-term risks. Let’s review your insulin regimen, medication adherence, meal timings and composition, and exercise routine to pinpoint contributing factors.  We'll likely need to adjust your insulin doses or explore other management strategies.";
  } else if (Math.round(tod_analysis.highPercentage) >= 10) {
    notes +=
      "    * Your time spent above target is too high and significantly increases your risk of long-term complications. This requires closer attention.  We need to carefully review your current management plan, including your basal and bolus insulin doses, carbohydrate ratios, and correction factors. We'll also consider additional factors that may be influencing your glucose levels, such as stress, illness, or medications. It's important to address this promptly to protect your long-term health.";
  }
  return notes;
}
