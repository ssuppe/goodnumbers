import { describe, it, expect } from 'vitest';
import { SchemaType } from '@google/generative-ai';
import { COACH_INVESTIGATIVE_TOOLS } from '../../../../src/lib/ai/tools/declarations.js';

describe('COACH_INVESTIGATIVE_TOOLS Declarations', () => {
  const EXPECTED_TOOL_NAMES = [
    'compare_recurring_time_window',
    'get_profile_and_override_history',
    'find_successful_reference_days',
    'get_treatments_for_recurring_window',
    'check_day_of_week_pattern',
    'get_post_meal_peak_trends',
    'search_treatment_notes',
    'get_temp_basal_and_suspends',
    'get_daily_insulin_and_carb_trends',
    'inspect_prior_context',
  ];

  it('exports exactly 10 tool declarations', () => {
    expect(COACH_INVESTIGATIVE_TOOLS).toHaveLength(10);
    const names = COACH_INVESTIGATIVE_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(EXPECTED_TOOL_NAMES));
  });

  it('has valid structure and non-empty descriptions for all tools', () => {
    for (const tool of COACH_INVESTIGATIVE_TOOLS) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);

      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.description!.length).toBeGreaterThan(15);

      expect(tool.parameters).toBeDefined();
      expect(tool.parameters!.type).toBe(SchemaType.OBJECT);
      expect(tool.parameters!.properties).toBeDefined();
      expect(typeof tool.parameters!.properties).toBe('object');
    }
  });

  describe('individual tool schemas match PRD specifications', () => {
    it('validates compare_recurring_time_window schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'compare_recurring_time_window',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toContain('timeWindow');
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.timeWindow).toBeDefined();
      expect(props.timeWindow.type).toBe(SchemaType.STRING);
      expect(props.timeWindow.enum).toEqual([
        'morning',
        'lunch',
        'afternoon',
        'evening',
        'overnight',
      ]);
      expect(props.days).toBeDefined();
      expect(props.days.type).toBe(SchemaType.INTEGER);
    });

    it('validates get_profile_and_override_history schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'get_profile_and_override_history',
      )!;
      expect(tool).toBeDefined();
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.days).toBeDefined();
      expect(props.days.type).toBe(SchemaType.INTEGER);
    });

    it('validates find_successful_reference_days schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'find_successful_reference_days',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toEqual(
        expect.arrayContaining(['targetWindow', 'metric']),
      );
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.targetWindow.enum).toEqual([
        'morning',
        'lunch',
        'afternoon',
        'evening',
        'overnight',
        'full_day',
      ]);
      expect(props.metric.enum).toEqual([
        'high_tir',
        'no_hypo',
        'flat_overnight',
        'minimal_post_meal_spike',
      ]);
    });

    it('validates get_treatments_for_recurring_window schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'get_treatments_for_recurring_window',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toEqual(
        expect.arrayContaining(['startHour', 'endHour']),
      );
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.startHour.type).toBe(SchemaType.INTEGER);
      expect(props.endHour.type).toBe(SchemaType.INTEGER);
      expect(props.treatmentType?.enum).toEqual([
        'all',
        'carbs',
        'insulin',
        'notes',
      ]);
    });

    it('validates check_day_of_week_pattern schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'check_day_of_week_pattern',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toContain('comparisonType');
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.comparisonType.enum).toEqual([
        'weekday_vs_weekend',
        'day_of_week',
        'specific_day',
      ]);
    });

    it('validates get_post_meal_peak_trends schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'get_post_meal_peak_trends',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toContain('meal');
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.meal.enum).toEqual(['breakfast', 'lunch', 'dinner']);
    });

    it('validates search_treatment_notes schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'search_treatment_notes',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toContain('query');
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.query.type).toBe(SchemaType.STRING);
    });

    it('validates get_temp_basal_and_suspends schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'get_temp_basal_and_suspends',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toEqual(
        expect.arrayContaining(['startDate', 'endDate']),
      );
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.startDate.type).toBe(SchemaType.STRING);
      expect(props.endDate.type).toBe(SchemaType.STRING);
    });

    it('validates get_daily_insulin_and_carb_trends schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'get_daily_insulin_and_carb_trends',
      )!;
      expect(tool).toBeDefined();
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.days.type).toBe(SchemaType.INTEGER);
    });

    it('validates inspect_prior_context schema', () => {
      const tool = COACH_INVESTIGATIVE_TOOLS.find(
        (t) => t.name === 'inspect_prior_context',
      )!;
      expect(tool).toBeDefined();
      expect(tool.parameters?.required).toContain('targetTimestamp');
      const props = tool.parameters?.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(props.targetTimestamp.type).toBe(SchemaType.STRING);
      expect(props.lookbackHours.type).toBe(SchemaType.INTEGER);
    });
  });
});
