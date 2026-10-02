import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const COACH_INVESTIGATIVE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'compare_recurring_time_window',
    description:
      'Slices CGM blood sugar readings for a specific recurring daily window (e.g. morning, lunch, afternoon, evening, overnight) across recent days to determine if an excursion was an isolated event or a recurring pattern.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        timeWindow: {
          type: SchemaType.STRING,
          format: 'enum',
          description:
            'The recurring time of day to inspect (morning: 06:00-10:00, lunch: 11:30-14:30, afternoon: 14:00-18:00, evening: 18:00-22:00, overnight: 00:00-06:00)',
          enum: ['morning', 'lunch', 'afternoon', 'evening', 'overnight'],
        },
        customStartHour: {
          type: SchemaType.INTEGER,
          description:
            'Optional custom start hour (0-23) if not using standard enum window',
        },
        customEndHour: {
          type: SchemaType.INTEGER,
          description: 'Optional custom end hour (0-23)',
        },
        days: {
          type: SchemaType.INTEGER,
          description: 'Number of past days to inspect (default: 7, max: 14)',
        },
      },
      required: ['timeWindow'],
    },
  },
  {
    name: 'get_profile_and_override_history',
    description:
      'Checks whether changes to pump settings, basal profiles, carb ratios, or active overrides took place during recent days.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: {
          type: SchemaType.INTEGER,
          description: 'Number of days back to inspect (default: 7, max: 14)',
        },
      },
    },
  },
  {
    name: 'find_successful_reference_days',
    description:
      'Scans recent days to find a successful benchmark day matching the target time window to give the coach a positive reference to contrast against.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetWindow: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Time window to evaluate for success benchmark',
          enum: [
            'morning',
            'lunch',
            'afternoon',
            'evening',
            'overnight',
            'full_day',
          ],
        },
        metric: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Criteria defining a successful benchmark day',
          enum: [
            'high_tir',
            'no_hypo',
            'flat_overnight',
            'minimal_post_meal_spike',
          ],
        },
        lookbackDays: {
          type: SchemaType.INTEGER,
          description: 'Number of past days to search back (default: 14)',
        },
      },
      required: ['targetWindow', 'metric'],
    },
  },
  {
    name: 'get_treatments_for_recurring_window',
    description:
      'Inspects logged carbs, insulin boluses, and food notes across multiple days within a specific clock hour bracket.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startHour: {
          type: SchemaType.INTEGER,
          description: 'Start hour 0-23 (e.g. 21 for 9 PM)',
        },
        endHour: {
          type: SchemaType.INTEGER,
          description: 'End hour 0-23 (e.g. 24 for midnight)',
        },
        days: {
          type: SchemaType.INTEGER,
          description: 'Past days to search (default: 7)',
        },
        treatmentType: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Filter by specific treatment category',
          enum: ['all', 'carbs', 'insulin', 'notes'],
        },
      },
      required: ['startHour', 'endHour'],
    },
  },
  {
    name: 'check_day_of_week_pattern',
    description:
      'Aggregates glycemic data by weekday vs weekend or specific days of the week to reveal routine-driven differences.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        comparisonType: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'How to group days for comparison',
          enum: ['weekday_vs_weekend', 'day_of_week', 'specific_day'],
        },
        specificDay: {
          type: SchemaType.STRING,
          format: 'enum',
          description:
            'Day name if specific_day comparison selected (e.g. Monday)',
          enum: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ],
        },
        lookbackWeeks: {
          type: SchemaType.INTEGER,
          description: 'Number of weeks to evaluate (default: 3, max: 4)',
        },
      },
      required: ['comparisonType'],
    },
  },
  {
    name: 'get_post_meal_peak_trends',
    description:
      'Evaluates postprandial 2-3 hour glucose excursion curves and peak dynamics following a meal time.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        meal: {
          type: SchemaType.STRING,
          format: 'enum',
          description: 'Meal type to inspect',
          enum: ['breakfast', 'lunch', 'dinner'],
        },
        days: {
          type: SchemaType.INTEGER,
          description: 'Past days to inspect (default: 7)',
        },
      },
      required: ['meal'],
    },
  },
  {
    name: 'search_treatment_notes',
    description:
      'Scans Nightscout treatment notes and comments for keyword strings (e.g. exercise, walk, stress, illness, alcohol).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description:
            'Keyword or term to search for in logs (e.g. gym, walk, stress, beer, sick)',
        },
        days: {
          type: SchemaType.INTEGER,
          description: 'Days back to search (default: 14)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_temp_basal_and_suspends',
    description:
      'Queries automated loop temp basals or pump suspensions to understand if automated delivery or suspension played a role in glycemic patterns.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: {
          type: SchemaType.STRING,
          description: 'Start date or ISO timestamp (e.g. YYYY-MM-DD)',
        },
        endDate: {
          type: SchemaType.STRING,
          description: 'End date or ISO timestamp (e.g. YYYY-MM-DD)',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'get_daily_insulin_and_carb_trends',
    description:
      'Compares total daily insulin (TDD), basal vs bolus breakdown, and total carbs logged day by day across recent days.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: {
          type: SchemaType.INTEGER,
          description: 'Number of past days to inspect (default: 7)',
        },
      },
    },
  },
  {
    name: 'inspect_prior_context',
    description:
      'Inspects a tight 4-to-8 hour window immediately preceding a specific event or timestamp to reveal preceding treatments, meals, and glucose trajectory.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetTimestamp: {
          type: SchemaType.STRING,
          description:
            'The timestamp of the event to look backwards from (ISO string)',
        },
        lookbackHours: {
          type: SchemaType.INTEGER,
          description:
            'Hours to look back before the event (default: 4, max: 8)',
        },
      },
      required: ['targetTimestamp'],
    },
  },
];
