// backend/src/lib/ai/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GlycemicCluster,
  Insight,
  GlucoseUnit,
  Highlight,
} from '@goodnumbers/types';
import {
  EXECUTIVE_SUMMARY_PROMPT,
  CLUSTER_AI_INSIGHT_PROMPT,
} from './prompts.js';
import { formatInfluencingFactors } from './utils.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

const proModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-pro-preview',
  generationConfig: { responseMimeType: 'application/json' },
});
// Use Gemini 3.1 Flash for fast fallback with high intelligence
const flashModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-preview',
  generationConfig: { responseMimeType: 'application/json' },
});

export interface TreatmentContext {
  date: number;
  carbs?: number;
  insulin?: number;
}

export interface ClusterAIResult {
  assessment: string;
  reflectionForDoctor: string;
  quickLogSuggestions: string[];
}

/**
 * Helper to clean and parse JSON from AI response
 */
function parseAIJson<T>(text: string, defaultValue: T): T {
  try {
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson) as T;
  } catch (e) {
    console.error('[Gemini] Failed to parse AI JSON:', e, 'Raw text:', text);
    return defaultValue;
  }
}

/**
 * Generates a clinical assessment for a specific cluster of glucose events.
 */
export async function generateClusterAIInsight(
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  treatments: TreatmentContext[],
  timezone: string,
  weeklyVibe: string | null | undefined,
  influencingFactors: string[] | null | undefined,
): Promise<ClusterAIResult> {
  const defaultResult: ClusterAIResult = {
    assessment: 'AI assessment unavailable.',
    reflectionForDoctor: '',
    quickLogSuggestions: [],
  };

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[Gemini] Missing API Key. Skipping AI insight generation.');
    return {
      ...defaultResult,
      assessment: 'AI assessment unavailable (API Key missing).',
    };
  }

  const prompt = CLUSTER_AI_INSIGHT_PROMPT(
    cluster,
    deterministicInsights,
    preferredUnits,
    treatments,
    timezone,
    {
      vibe: weeklyVibe || null,
      factors: formatInfluencingFactors(influencingFactors),
    },
  );

  console.log(
    `[Gemini] Attempting Pro assessment for cluster ${cluster.id}...`,
  );

  try {
    const result = await proModel.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseAIJson<{
      assessment: string;
      reflection_for_doctor: string;
      quick_log_suggestions: string[];
    }>(text, {
      assessment: 'Failed to parse assessment.',
      reflection_for_doctor: '',
      quick_log_suggestions: [],
    });

    console.log(`[Gemini] Pro model success for ${cluster.id}`);
    return {
      assessment: parsed.assessment,
      reflectionForDoctor: parsed.reflection_for_doctor,
      quickLogSuggestions: parsed.quick_log_suggestions,
    };
  } catch (proError: unknown) {
    const proErrorMessage =
      proError instanceof Error ? proError.message : String(proError);
    console.error(
      `[Gemini] Pro model failed for ${cluster.id}: ${proErrorMessage}`,
    );

    console.log(
      `[Gemini] Attempting Flash model fallback for ${cluster.id}...`,
    );
    try {
      const result = await flashModel.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseAIJson<{
        assessment: string;
        reflection_for_doctor: string;
        quick_log_suggestions: string[];
      }>(text, {
        assessment: 'Failed to parse assessment.',
        reflection_for_doctor: '',
        quick_log_suggestions: [],
      });

      console.log(`[Gemini] Flash fallback success for ${cluster.id}`);
      return {
        assessment: `${parsed.assessment}\n\n(Note: Generated using fallback model)`,
        reflectionForDoctor: parsed.reflection_for_doctor,
        quickLogSuggestions: parsed.quick_log_suggestions,
      };
    } catch (flashError: unknown) {
      const flashErrorMessage =
        flashError instanceof Error ? flashError.message : String(flashError);
      console.error(
        `[Gemini] Critical failure: All models failed for ${cluster.id}: ${flashErrorMessage}`,
      );
      return defaultResult;
    }
  }
}

/**
 * Generates an executive summary of the week.
 */
export async function generateExecutiveSummary(
  currentStats: {
    avgGlucose: number;
    timeInRange: number;
    stability: number;
    lowPercentage: number;
  },
  previousStats: {
    avgGlucose: number;
    timeInRange: number;
    stability: number;
  } | null,
  preferredUnits: GlucoseUnit,
): Promise<Highlight[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = EXECUTIVE_SUMMARY_PROMPT(
    currentStats,
    previousStats,
    preferredUnits,
  );

  try {
    // Re-getting model just to be sure config is applied if needed,
    // although flashModel should already have it.
    const result = await flashModel.generateContent(prompt);
    const text = result.response.text();
    return parseAIJson<Highlight[]>(text, []);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini] Executive Summary failed: ${errorMessage}`);
    return [];
  }
}
