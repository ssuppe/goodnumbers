import { NightscoutClient } from '../../nightscout/client.js';
import {
  NightscoutEntry,
  NightscoutTreatment,
} from '../../nightscout/types.js';

export interface LocalGlucosePoint {
  date: number;
  sgv: number;
  direction?: string;
}

export interface LocalJournalData {
  treatments?: Array<Record<string, unknown>>;
  bloodGlucose?: LocalGlucosePoint[];
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface ToolExecutionContext {
  userId: string;
  preferredUnits: 'mmol/L' | 'mg/dL';
  timezone: string;
  nsClient: NightscoutClient;
  localJournalData?: LocalJournalData;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<Record<string, unknown>>;

// Cache entries with a 60-second TTL
interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

const entriesCache = new Map<string, CacheItem<NightscoutEntry[]>>();
const treatmentsCache = new Map<string, CacheItem<NightscoutTreatment[]>>();
const CACHE_TTL_MS = 60 * 1000;

export function clearToolCache(): void {
  entriesCache.clear();
  treatmentsCache.clear();
}

export async function getCachedNightscoutEntries(
  context: ToolExecutionContext,
  from: Date,
  to: Date,
): Promise<NightscoutEntry[]> {
  // Fast Path: Check if localJournalData has bloodGlucose that covers [from, to]
  const localGlucose = context.localJournalData?.bloodGlucose;
  if (Array.isArray(localGlucose) && localGlucose.length > 0) {
    const dates = localGlucose.map((p) => p.date).filter(Boolean);
    if (dates.length > 0) {
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      if (
        from.getTime() >= minDate - 12 * 3600 * 1000 &&
        to.getTime() <= maxDate + 12 * 3600 * 1000
      ) {
        return localGlucose
          .filter((p) => p.date >= from.getTime() && p.date <= to.getTime())
          .map((p) => ({
            _id: `local-${p.date}`,
            date: p.date,
            sgv: p.sgv,
            direction: p.direction || 'Flat',
          })) as unknown as NightscoutEntry[];
      }
    }
  }

  const key = `${context.userId}:${from.getTime()}:${to.getTime()}`;
  const now = Date.now();
  const cached = entriesCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await context.nsClient.fetchEntries(from, to);
  entriesCache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

export async function getCachedNightscoutTreatments(
  context: ToolExecutionContext,
  from: Date,
  to: Date,
): Promise<NightscoutTreatment[]> {
  // Fast Path: Check if localJournalData has treatments covering [from, to]
  const localTreatments = context.localJournalData?.treatments;
  if (Array.isArray(localTreatments) && localTreatments.length > 0) {
    const dates = localTreatments
      .map((t) => {
        const dateVal = t.date;
        const createdAt = t.created_at;
        return typeof dateVal === 'number'
          ? dateVal
          : createdAt
            ? new Date(String(createdAt)).getTime()
            : 0;
      })
      .filter(Boolean);
    if (dates.length > 0) {
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      if (
        from.getTime() >= minDate - 12 * 3600 * 1000 &&
        to.getTime() <= maxDate + 12 * 3600 * 1000
      ) {
        return localTreatments.filter((t) => {
          const dateVal = t.date;
          const createdAt = t.created_at;
          const tTime =
            typeof dateVal === 'number'
              ? dateVal
              : createdAt
                ? new Date(String(createdAt)).getTime()
                : 0;
          return tTime >= from.getTime() && tTime <= to.getTime();
        }) as unknown as NightscoutTreatment[];
      }
    }
  }

  const key = `${context.userId}:${from.getTime()}:${to.getTime()}`;
  const now = Date.now();
  const cached = treatmentsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await context.nsClient.fetchTreatments(from, to);
  treatmentsCache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

import { handleCompareTimeWindow } from './handlers/compareTimeWindow.js';
import { handleProfileOverrides } from './handlers/profileOverrides.js';
import { handleReferenceDays } from './handlers/referenceDays.js';
import { handleRecurringTreatments } from './handlers/recurringTreatments.js';
import { handleDayOfWeekPattern } from './handlers/dayOfWeekPattern.js';
import { handlePostMealPeaks } from './handlers/postMealPeaks.js';
import { handleSearchNotes } from './handlers/searchNotes.js';
import { handleTempBasals } from './handlers/tempBasals.js';
import { handleInsulinCarbTrends } from './handlers/insulinCarbTrends.js';
import { handlePriorContext } from './handlers/priorContext.js';

// Registry of tool handlers
const registeredHandlers: Record<string, ToolHandler> = {
  compare_recurring_time_window: handleCompareTimeWindow,
  get_profile_and_override_history: handleProfileOverrides,
  find_successful_reference_days: handleReferenceDays,
  get_treatments_for_recurring_window: handleRecurringTreatments,
  check_day_of_week_pattern: handleDayOfWeekPattern,
  get_post_meal_peak_trends: handlePostMealPeaks,
  search_treatment_notes: handleSearchNotes,
  get_temp_basal_and_suspends: handleTempBasals,
  get_daily_insulin_and_carb_trends: handleInsulinCarbTrends,
  inspect_prior_context: handlePriorContext,
};

export function registerToolHandler(name: string, handler: ToolHandler): void {
  registeredHandlers[name] = handler;
}

export interface DispatchOptions {
  timeoutMs?: number;
  handlers?: Record<string, ToolHandler>;
}

export async function dispatchToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  options?: DispatchOptions,
): Promise<Record<string, unknown>> {
  const timeoutMs = options?.timeoutMs ?? 8000; // 8-second circuit breaker default

  const availableHandlers = options?.handlers ?? registeredHandlers;
  const handler = availableHandlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool ${name} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    // Unref timer if running in Node to avoid blocking process exit in tests
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  const executionPromise = handler(args, context);

  return await Promise.race([executionPromise, timeoutPromise]);
}
