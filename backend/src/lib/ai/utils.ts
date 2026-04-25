// backend/src/lib/ai/utils.ts

const FACTOR_MAPPING: Record<string, string> = {
  'Diet:FatProtein': 'Heavy or Fatty Meal',
  'Diet:CarbError': 'Carb Counting Mistake',
  'Diet:EatingOut': 'Ate New or Restaurant Food',
  'Logistics:Alcohol': 'Drank Alcohol',
  'Exercise:Strenuous': 'Harder Exercise than Planned',
  'Exercise:Sedentary': 'Very Little Exercise',
  'Biological:Illness': 'Felt Sick (Cold, Flu, etc.)',
  'Biological:Hormonal': 'Hormone Changes',
  'Biological:Dehydration': 'Felt Dehydrated',
  'Meds:SetChange': 'Problematic Infusion Set Change',
  'Meds:Steroids': 'Changed medications',
  'Emotional:StressAcute': 'Major Stressful Event',
  'Emotional:Anxiety': 'Feeling Anxious or Tense',
  'Emotional:SleepQuality': 'Slept Poorly',
  'Logistics:Travel': 'Traveling or Time Zone Change',
  'System:Malfunction': 'Pump or Sensor Problem',
};

/**
 * Formats an array of influencing factor keys into a comma-separated string of human-readable labels.
 */
export function formatInfluencingFactors(
  factors: string[] | null | undefined,
): string {
  if (!factors || factors.length === 0) {
    return 'None reported';
  }

  return factors.map((f) => FACTOR_MAPPING[f] || f).join(', ');
}
