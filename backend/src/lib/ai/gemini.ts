import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import {
  GlycemicCluster,
  Insight,
  GlucoseUnit,
  Highlight,
} from '@goodnumbers/types';
import {
  EXECUTIVE_SUMMARY_PROMPT,
  CLUSTER_AI_INSIGHT_PROMPT,
  CLUSTER_AI_CHAT_PROMPT,
  CLUSTER_AI_SYNTHESIS_PROMPT,
  type ChatMessage,
} from './prompts.js';
import { formatInfluencingFactors } from './utils.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');

const insightSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    assessment: { type: SchemaType.STRING },
    reflection_for_doctor: { type: SchemaType.STRING },
    quick_log_suggestions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    initial_prompt: { type: SchemaType.STRING },
  },
  required: [
    'assessment',
    'reflection_for_doctor',
    'quick_log_suggestions',
    'initial_prompt',
  ],
};

const highlightSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['win', 'warn', 'focus', 'opportunity', 'trend'],
    },
    icon: { type: SchemaType.STRING },
    title: { type: SchemaType.STRING },
    short_description: { type: SchemaType.STRING },
  },
  required: ['type', 'icon', 'title', 'short_description'],
};

const summarySchema: Schema = {
  type: SchemaType.ARRAY,
  items: highlightSchema,
};

const insightProModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-pro-preview',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: insightSchema,
  },
});

const insightFlashModel = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: insightSchema,
  },
});

const summaryFlashModel = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: summarySchema,
  },
});

// For plain-text generation (e.g. chat dialogues and text summaries)
const textFlashModel = genAI.getGenerativeModel({
  model: 'gemini-3-flash-preview',
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
  initialPrompt?: string;
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
    initialPrompt: '',
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
    const result = await insightProModel.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseAIJson<{
      assessment: string;
      reflection_for_doctor: string;
      quick_log_suggestions: string[];
      initial_prompt?: string;
    }>(text, {
      assessment: 'Failed to parse assessment.',
      reflection_for_doctor: '',
      quick_log_suggestions: [],
      initial_prompt: '',
    });

    if (
      !parsed ||
      !parsed.assessment ||
      parsed.assessment === 'Failed to parse assessment.' ||
      !parsed.reflection_for_doctor
    ) {
      throw new Error('Pro model returned invalid or fallback JSON structure');
    }

    console.log(`[Gemini] Pro model success for ${cluster.id}`);
    return {
      assessment: parsed.assessment,
      reflectionForDoctor: parsed.reflection_for_doctor,
      quickLogSuggestions: parsed.quick_log_suggestions,
      initialPrompt: parsed.initial_prompt || '',
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
      const result = await insightFlashModel.generateContent(prompt);
      const text = result.response.text();
      const parsed = parseAIJson<{
        assessment: string;
        reflection_for_doctor: string;
        quick_log_suggestions: string[];
        initial_prompt?: string;
      }>(text, {
        assessment: 'Failed to parse assessment.',
        reflection_for_doctor: '',
        quick_log_suggestions: [],
        initial_prompt: '',
      });

      if (
        !parsed ||
        !parsed.assessment ||
        parsed.assessment === 'Failed to parse assessment.' ||
        !parsed.reflection_for_doctor
      ) {
        throw new Error(
          'Flash model returned invalid or fallback JSON structure',
        );
      }

      console.log(`[Gemini] Flash fallback success for ${cluster.id}`);
      return {
        assessment: `${parsed.assessment}\n\n(Note: Generated using fallback model)`,
        reflectionForDoctor: parsed.reflection_for_doctor,
        quickLogSuggestions: parsed.quick_log_suggestions,
        initialPrompt: parsed.initial_prompt || '',
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
  patterns?: string[],
): Promise<Highlight[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = EXECUTIVE_SUMMARY_PROMPT(
    currentStats,
    previousStats,
    preferredUnits,
    patterns || [],
  );

  try {
    // Re-getting model just to be sure config is applied if needed,
    // although flashModel should already have it.
    const result = await summaryFlashModel.generateContent(prompt);
    const text = result.response.text();
    const highlights = parseAIJson<Highlight[]>(text, []);

    // Clinical Hypo Rule Override: If TBR > 4%, ensure Box 1 (index 0) addresses the lows.
    if (currentStats.lowPercentage > 4 && highlights.length > 0) {
      const isFirstHypo =
        highlights[0].type === 'warn' ||
        highlights[0].type === 'focus' ||
        highlights[0].type === 'opportunity';
      if (!isFirstHypo) {
        const hypoIdx = highlights.findIndex(
          (h) =>
            h.type === 'warn' || h.type === 'focus' || h.type === 'opportunity',
        );
        if (hypoIdx !== -1) {
          // Move the hypo card to the first slot
          const [hypoCard] = highlights.splice(hypoIdx, 1);
          highlights.unshift(hypoCard);
        } else {
          // Convert the first card to an opportunity card addressing the low range
          highlights[0] = {
            type: 'opportunity',
            icon: '⚠️',
            title: 'Lows Focus Opportunity',
            short_description: `Your Time Below Range was ${Math.round(currentStats.lowPercentage)}% this week, which is above the 4% safety threshold. Focus on reducing these lows first.`,
          };
        }
      }
    }

    return highlights;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini] Executive Summary failed: ${errorMessage}`);
    return [];
  }
}

export async function generateChatResponse(
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  weeklyContext: { vibe: string | null; factors: string },
  chatHistory: ChatMessage[],
  newMessage: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "I'm sorry, my AI features are currently offline (API key missing).";
  }

  const prompt = CLUSTER_AI_CHAT_PROMPT(
    cluster,
    deterministicInsights,
    preferredUnits,
    weeklyContext,
    chatHistory,
    newMessage,
  );

  try {
    const result = await textFlashModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini] Chat response generation failed: ${errorMessage}`);
    return "I'm sorry, I encountered an error while processing that. Please try again.";
  }
}

export async function synthesizeChatInsight(
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  chatHistory: ChatMessage[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'AI synthesis unavailable (API key missing).';
  }

  const prompt = CLUSTER_AI_SYNTHESIS_PROMPT(
    cluster,
    deterministicInsights,
    preferredUnits,
    chatHistory,
  );

  try {
    const result = await textFlashModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Gemini] Chat synthesis failed: ${errorMessage}`);
    return "I'm sorry, I was unable to synthesize the notes at this time.";
  }
}
