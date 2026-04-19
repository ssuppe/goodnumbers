// backend/src/lib/ai/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GlycemicCluster, Insight, GlucoseUnit } from '@goodnumbers/types';
import { CLUSTER_AI_INSIGHT_PROMPT } from './prompts.js';

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Use Gemini 3.1 Pro for flagship reasoning and clinical assessment
const proModel = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });
// Use Gemini 3.1 Flash for fast fallback with high intelligence
const flashModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-preview',
});

export interface TreatmentContext {
  date: number;
  carbs?: number;
  insulin?: number;
}

/**
 * Generates a clinical assessment for a specific cluster of glucose events.
 */
export async function generateClusterAIInsight(
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  treatments: TreatmentContext[], // Fixed any
  timezone: string, // Added timezone
): Promise<string> {
  if (!API_KEY) {
    console.warn('[Gemini] Missing API Key. Skipping AI insight generation.');
    return 'AI assessment unavailable (API Key missing).';
  }

  const prompt = CLUSTER_AI_INSIGHT_PROMPT(
    cluster,
    deterministicInsights,
    preferredUnits,
    treatments,
    timezone,
  );

  console.log(
    `[Gemini] Attempting Pro assessment for cluster ${cluster.id}...`,
  );

  try {
    const result = await proModel.generateContent(prompt);
    const text = result.response.text();
    console.log(`[Gemini] Pro model success for ${cluster.id}`);
    return text;
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
      console.log(`[Gemini] Flash fallback success for ${cluster.id}`);
      return `${text}\n\n(Note: Generated using fallback model)`;
    } catch (flashError: unknown) {
      const flashErrorMessage =
        flashError instanceof Error ? flashError.message : String(flashError);
      console.error(
        `[Gemini] Critical failure: All models failed for ${cluster.id}:`,
        flashErrorMessage,
      );
      return 'Failed to generate AI assessment.';
    }
  }
}
