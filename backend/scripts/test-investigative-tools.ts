import {
  dispatchToolCall,
  ToolExecutionContext,
} from '../src/lib/ai/tools/dispatcher.js';
import { NightscoutClient } from '../src/lib/nightscout/client.js';

async function runSmokeTest() {
  console.log('--- Quick Coach Investigative Tools: Smoke Test ---');

  const now = Date.now();
  const mockEntries = [
    { date: now - 3600000 * 2, sgv: 110, direction: 'Flat' },
    { date: now - 3600000 * 1, sgv: 165, direction: 'FortyFiveUp' },
    { date: now, sgv: 130, direction: 'Flat' },
  ];

  const mockTreatments = [
    {
      date: now - 3600000 * 2,
      eventType: 'Meal Bolus',
      carbs: 45,
      insulin: 4.5,
      notes: 'Oatmeal breakfast',
    },
    {
      date: now - 3600000 * 1,
      eventType: 'Temp Basal',
      duration: 30,
      rate: 1.2,
      insulin: 0.6,
      notes: 'Temp adjustment',
    },
  ];

  const mockProfile = [
    {
      defaultProfile: 'Standard',
      store: {
        Standard: {
          timezone: 'America/New_York',
          basal: [{ time: '00:00', value: 0.9 }],
        },
      },
    },
  ];

  const mockNsClient = {
    fetchEntries: async () => mockEntries,
    fetchTreatments: async () => mockTreatments,
    fetchProfile: async () => mockProfile,
  } as unknown as NightscoutClient;

  const context: ToolExecutionContext = {
    userId: 'smoke-test-user',
    preferredUnits: 'mmol/L',
    timezone: 'America/New_York',
    nsClient: mockNsClient,
  };

  const testCalls: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: 'compare_recurring_time_window', args: { timeWindow: 'morning' } },
    { name: 'get_profile_and_override_history', args: { days: 7 } },
    {
      name: 'find_successful_reference_days',
      args: { targetWindow: 'morning', metric: 'high_tir' },
    },
    {
      name: 'get_treatments_for_recurring_window',
      args: { startHour: 6, endHour: 10 },
    },
    {
      name: 'check_day_of_week_pattern',
      args: { comparisonType: 'weekday_vs_weekend' },
    },
    { name: 'get_post_meal_peak_trends', args: { meal: 'lunch' } },
    { name: 'search_treatment_notes', args: { query: 'oatmeal' } },
    {
      name: 'get_temp_basal_and_suspends',
      args: { startDate: '2026-09-28', endDate: '2026-09-29' },
    },
    { name: 'get_daily_insulin_and_carb_trends', args: { days: 7 } },
    {
      name: 'inspect_prior_context',
      args: { targetTimestamp: new Date().toISOString() },
    },
  ];

  let passed = 0;
  for (const call of testCalls) {
    const start = performance.now();
    try {
      const result = await dispatchToolCall(call.name, call.args, context);
      const elapsed = (performance.now() - start).toFixed(1);
      console.log(
        `[PASS] ${call.name} (${elapsed}ms):`,
        JSON.stringify(result),
      );
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${call.name}:`, err);
    }
  }

  console.log(
    `\nSmoke test finished: ${passed}/${testCalls.length} tools succeeded.`,
  );
}

runSmokeTest().catch(console.error);
