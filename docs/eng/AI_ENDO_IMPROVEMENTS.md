# Engineering Plan: AI Endo-Brain Improvements (Cluster Insights)

**Status:** In Progress (Stage 1 Complete)  
**Target Date:** 2026-04-26  
**Complexity:** High (AI Prompt Engineering + Data Mapping)

## 1. Overview

The goal of this task is to evolve the AI "Co-pilot" from a simple data narrator into a **Physiological Analyst**. Instead of describing individual glucose events day-by-day, the AI will now synthesize patterns across recurring clusters to identify the underlying mechanical causes (e.g., insulin timing, basal gaps, or hormonal effects).

### Core Principles

- **Physiological Narrative:** Focus on the "Why," not just the "What."
- **Trend Synthesis:** Explicitly forbid day-by-day reporting; identify commonalities across the week.
- **Socratic Reflection:** Frame recommendations as discussion starters for the user and their doctor.
- **Grounded Evidence:** Use 3-hour pre-event windows to detect phenomena like the Somogyi effect.

---

## 2. Phased Implementation Roadmap

### **Stage 1: The Context Pipeline (Data Delivery)**

**Goal:** Ingest the user's subjective "Weekly Context" (Vibe and Influencing Factors) into the AI payload.

- **Tasks:**
  - [x] Create `formatInfluencingFactors(factors: any): string` utility in `backend/src/lib/ai/utils.ts`.
  - [x] Update `generateClusterAIInsight` signature in `gemini.ts` to accept `vibe` and `formattedFactors`.
  - [x] Update `backend/src/worker.ts` to extract these fields from the `Journal` and pass them to the AI service.
- **Verification:** Logged the generated prompt and confirmed the "WEEKLY CONTEXT" block is correctly populated. Unit tests verified 95%+ coverage for mapping logic.

### **Stage 2: Structural Refactor (Output Schema)**

**Goal:** Update the JSON output format and enforce strict "Trend-Only" constraints.

- **Tasks:**
  - Update the prompt's `OUTPUT STRUCTURE` to include `reflection_for_doctor` and `assessment`.
  - Enforce the constraint: `ABSOLUTELY NO day-by-day markers (e.g., "On Monday")`.
  - Update the AI service's JSON parser to handle the new keys.
- **Verification:** Confirm the AI no longer itemizes days and returns the new reflection field.

### **Stage 3: Physiological Logic (The 4 Pillars)**

**Goal:** Introduce the clinical heuristic framework (The "Endo-Brain").

- **Tasks:**
  - Inject the **4 Pillars Analysis Framework** (Floor, Fuel, Variable, Engine) into the prompt instructions.
  - Expand `buildRawEvidence` in `prompts.ts` to provide a **3-hour window** before each event (essential for Somogyi effect detection).
  - Add specific logic for macronutrient composition (shape of the curve).
- **Verification:** Test against a "Dawn Phenomenon" cluster and verify the AI identifies the early morning rise vs. a rebound high.

### **Stage 4: Tuning & Safety Polish**

**Goal:** Final refinement of the tone and liability safety.

- **Tasks:**
  - Constrain "Reflections for your Doctor" to include specific time-blocks (e.g., "between 3 AM and 6 AM").
  - Final audit of the persona to ensure it remains a "Specialist Analyst" and not a "Medical Prescriber."
- **Verification:** End-to-end dry run with diverse clusters (Hyper, Hypo, and Post-Meal).

---

## 3. Design Decisions & Learnings (Stage 1)

### 3.1 Cost Optimization (Lite Models)

To minimize API costs during testing and development, we implemented environment-aware model selection in `backend/src/lib/ai/gemini.ts`:

- **Production:** Uses `gemini-3.1-pro-preview` for flagship reasoning.
- **Testing/Development:** Automatically falls back to `gemini-3.1-flash-lite-preview` when `NODE_ENV=test` or as a secondary fallback.
- **Safety:** Maintained `pro` as the primary for non-test environments to ensure high-quality clinical synthesis.

### 3.2 Frontend Integration (Deterministic Insights)

We successfully integrated the deterministic heuristic insights into the `ChartAnalysisCard`.

- **Zippy State:** Implemented a "Detailed Analysis" collapsible section to keep the UI clean while providing deep-dive data.
- **Unified Rows:** Created `UnifiedInsightRow` to standardize how AI and deterministic insights are presented.

### 3.3 Data Isolation

Verified cross-user data isolation in `journals.test.ts` to ensure users can only access and update their own journal data, especially as we add more personal environmental context.

---

## 4. The Target Prompt (v2.0)

```typescript
// Proposed structure for Stage 3/4
export const CLUSTER_AI_INSIGHT_PROMPT = (
  cluster: GlycemicCluster,
  deterministicInsights: Insight[],
  preferredUnits: GlucoseUnit,
  treatments: TreatmentContext[],
  timezone: string,
  weeklyContext: { vibe: string | null; factors: string },
) => {
  return `
You are a specialist diabetes data analyst. Your goal is to identify the "Physiological Narrative" across this recurring cluster of events.

WEEKLY CONTEXT:
- Overall Vibe: ${weeklyContext.vibe || "Not reported"}
- Influencing Factors: ${weeklyContext.factors}

ANALYSIS FRAMEWORK:
1. THE FLOOR (Basal/Dawn/Somogyi): If early morning, distinguish between "Dawn Phenomenon" (rise) and the "Somogyi Effect" (rebound from nighttime low).
2. THE FUEL (Bolus/Timing/Composition): Analyze the shape of the curve. Sharp early spike (timing) or delayed rise (fat/protein)?
3. THE VARIABLE (Resistance/Hormones): Correlate data with stress, illness, or travel reported in the context.
4. THE ENGINE (Activity): Look for aerobic drops, anaerobic spikes, or delayed muscle-rebuild lows.

OUTPUT STRUCTURE:
{
  "assessment": "Synthesis of the physiological 'why'. NO day-by-day narration.",
  "reflection_for_doctor": "Discussion starters for the user's next visit. Mention specific time blocks.",
  "quick_log_suggestions": ["3 short, 2-4 word phrases"]
}

CONSTRAINTS:
- ABSOLUTELY NO chronological markers like 'On Tuesday' or 'In the first event.'
- Use 'blood sugar' instead of 'glucose.'
- Frame all insights as patterns for reflection, never as medical prescriptions.
`;
};
```

---

## 5. Junior Engineer Guide: Key Files to Watch

- `backend/src/worker.ts`: This is where the data is gathered. Ensure you handle the JSON `influencingFactors` safely (it may be null or a partial object).
- `backend/src/lib/ai/prompts.ts`: This is the heart of the change. Use the `u()` utility for all glucose values.
- `backend/tests/unit/ai/prompts.test.ts`: You **must** update the unit tests first (TDD). The tests should fail when the prompt doesn't match the new physiological requirements.

---

## 6. Definition of Done

- [ ] AI output successfully synthesizes trends across at least 3 days.
- [ ] No "Day-by-day" narration present in any test cluster.
- [ ] The Somogyi effect is correctly hypothesized when a 2 AM low precedes a 7 AM high.
- [ ] All unit tests pass with the new JSON structure.
- [ ] PRD and Implementation Plan updated to reflect v2.0 AI Insights.
