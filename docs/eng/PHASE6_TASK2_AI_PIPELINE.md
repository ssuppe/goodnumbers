# Goodnumbers: Phase 6 Task 2 — AI Text Pipeline & Analyst View

## TL;DR
Implement a secure, text-only AI pipeline using Gemini 3.0 to generate Clinical Assessments and Podcast Scripts, displayed in a new "Analyst View" tabbed interface for user verification.

## Invariants (do not change)

1.  **Privacy & Compliance**: 
    -   **Recommendation**: Use **Vertex AI** (via Google Cloud SDK) instead of the consumer `generative-ai` SDK. Vertex AI supports HIPAA compliance (with a BAA) and ensures data is **not** used for model training.
    -   **Constraint**: If using the standard API Key (Consumer), a strict **Data Warning** must be shown to the user during onboarding that their data may be used for quality purposes unless they opt-out (if applicable) or use Enterprise.
    -   **Anonymization**: Never send User Real Names or Emails to the LLM. Use `JournalID` or a random Session ID.
2.  **Medical Disclaimer**: Every AI-generated UI element must be accompanied by a "Not Medical Advice" banner.
3.  **Deterministic Storage**: AI outputs (text) are stored in the DB as `JSON`. We do not regenerate on every view.
4.  **Model Versioning**: Target `gemini-3.0` models. Configuration must be centralized to easily fallback to `2.0` or `1.5` if `3.0` is gated.

## Assumptions & Scope

-   **Assumption**: User has access to `gemini-3.0` models via their API Key or Google Cloud Project.
-   **Assumption**: `analysisInsights` column in `Journal` (currently `Json?`) will store the structured output.
-   **Scope**:
    -   Backend Service: `AiAssessmentService` (Pass 1 & 2) and `ScriptService` (Pass 3).
    -   Worker Integration: Orchestrate generation after stats calculation.
    -   Frontend: `AnalystTabs` component (Clinical Report | Podcast Script | Debug Info).
-   **Out of Scope**: Audio generation (TTS), SSML enhancement (Pass 4), Audio storage.

## Objectives

1.  **Insight Generation**: Generate a high-quality "Clinical Assessment" (Pass 1 & 2) using reasoning models.
2.  **Script Generation**: Generate a "Podcast Script" (Pass 3) optimized for reading, but displayed as text.
3.  **Transparency**: Provide a UI for the user to read exactly what the AI "thinks" about their data.
4.  **Safety**: Validate that the AI did not output PII or obviously dangerous advice (keyword filtering).

## Risks & Mitigations

-   **Risk**: **Data Privacy Leak**. Sending health data to a public LLM.
    -   *Mitigation*: Use Vertex AI Client. Sanitize input prompts (remove user metadata).
-   **Risk**: **Hallucination / Medical Advice**.
    -   *Mitigation*: UI Disclaimer. System Prompt engineering ("You are an analyst, not a doctor").
-   **Risk**: **Model Availability**. `gemini-3.0` might be unavailable.
    -   *Mitigation*: Configurable `AI_MODEL_NAME` env var. Fallback to `gemini-2.0-flash-exp`.

## Method Outline

1.  **Infrastructure (Vertex vs Standard)**: Implement an `AiClient` interface that abstracts the provider. Default to standard for dev speed, but document Vertex switch for production.
2.  **Service Layer**: Port `assessmentService.ts` and `podcastService.ts` (Pass 3 only) to `backend/src/services/ai/`.
3.  **Worker Logic**: Add a step to `processJournalJob`: `generateTextAnalysis(journalId)`.
4.  **Database**: Define a Zod schema for the `analysisInsights` JSON blob.
5.  **Frontend**: Build `JournalAnalystWidget` with Tabs (Headless UI).

## Implementation Notes

### Data Model (`analysisInsights` JSON Structure)

```typescript
type AnalysisInsights = {
  version: number; // 1
  model: string;   // "gemini-3.0-pro"
  clinicalAssessment: {
    pass1Raw: string;
    finalReport: string; // Pass 2
  };
  podcastScript: {
    dialogue: string; // Pass 3 (Script only, no SSML tags yet)
  };
  metadata: {
    generatedAt: string;
  };
}
```

### Prompt Strategy (Gemini 3.0)

-   **Pass 1 (Data -> Observations)**: "Analyze these glucose entries. Identify 3 key patterns."
-   **Pass 2 (Observations -> Clinical Note)**: "Synthesize these observations into a clinical note for the patient."
-   **Pass 3 (Clinical Note -> Script)**: "Convert this note into a dialogue between Dr. Turner and Rebecca."

## Acceptance Gates

1.  **Privacy**: `userId`, `email`, `name` are strictly filtered out of the prompt payload.
2.  **Persistence**: `analysisInsights` is successfully saved to the `Journal` record.
3.  **Display**: The Journal page shows a new section "Weekly Analysis" with tabs.
4.  **Safety**: The "Not Medical Advice" disclaimer is visible in the analysis section.

## “Make-sure-you” Checklist

-   [ ] **Model Config**: Use `process.env.GEMINI_MODEL || 'gemini-1.5-pro'` to allow easy switching if 3.0 fails.
-   [ ] **Type Safety**: Use `zod` to validate the JSON before saving to DB.
-   [ ] **Environment**: Ensure `GOOGLE_APPLICATION_CREDENTIALS` or `GEMINI_API_KEY` is set.
-   [ ] **Dependencies**: Install `@google/generative-ai` (if using standard) or `@google-cloud/vertexai` (if using Vertex).

## Project hygiene prep

1.  **Branch**: `git checkout -b feat/ai-text-analysis`
2.  **Dependencies**: `npm install @google/generative-ai` (Backend).

---

## In-depth Test Plan

### Phase 1: AI Service (Mocked)

**Goal**: Verify prompt construction and response parsing.

-   **Test 1: Input Sanitization**:
    -   Input: `User: John Doe, BG: [100, 120]`.
    -   Verify Prompt: Does NOT contain "John Doe".
-   **Test 2: Multi-Pass Flow**:
    -   Mock `Gemini.generate`.
    -   Call `generateJournalAnalysis(data)`.
    -   Verify sequence: Prompt 1 -> Response 1 -> Prompt 2 (w/ Resp 1) -> Prompt 3.
-   **Test 3: JSON Persistence**:
    -   Save a mock `AnalysisInsights` object to DB.
    -   Read it back and parse with Zod.

### Phase 2: Frontend Display

-   **Test 4: Tab Switching**:
    -   Click "Podcast Script" -> Shows dialogue.
    -   Click "Clinical Report" -> Shows report.
-   **Test 5: Empty State**:
    -   If `analysisInsights` is null, show "Analysis Pending" or nothing (do not crash).

---

## In-depth Engineering Plan

### Phase 1: Backend AI Service

**Step 1.1: AI Client Wrapper**
-   **File**: `backend/src/lib/ai/client.ts`
-   Implement `generateContent(prompt: string): Promise<string>`.
-   Config: Read `GEMINI_API_KEY` and `GEMINI_MODEL` (Default: `gemini-1.5-pro-latest`).
-   *Privacy Note*: Add a comment block explaining how to swap this file for Vertex AI.

**Step 1.2: Prompts & Templates**
-   **File**: `backend/src/lib/ai/prompts.ts`
-   Migrate `pass1.txt`, `pass2.txt`, `pass3.txt` to exported constant strings (or load from file).
-   Update system instructions to be concise for Gemini 3.0.

**Step 1.3: Assessment Service**
-   **File**: `backend/src/services/ai/assessmentService.ts`
-   Function: `generateWeeklyReport(entries: Entry[], treatments: Treatment[])`.
-   Logic:
    1.  Format data into a token-efficient text summary.
    2.  Run Pass 1 (Observations).
    3.  Run Pass 2 (Clinical Synthesis).
    4.  Run Pass 3 (Script Generation).
    5.  Return `AnalysisInsights` object.

### Phase 2: Worker Integration

**Step 2.1: Update Worker**
-   **File**: `backend/src/worker.ts`
-   Import `generateWeeklyReport`.
-   In `processJournalJob`, after `calculateAgp` and `HotspotDetector`:
    ```typescript
    // AI Stage
    await prisma.journal.update({ ... status: 'ANALYZING_PATTERNS' ... });
    const insights = await generateWeeklyReport(entries, treatments);
    // Save
    data: {
       analysisInsights: insights,
       status: 'COMPLETE'
    }
    ```

### Phase 3: Frontend Implementation

**Step 3.1: Type Definitions**
-   **File**: `packages/types/src/journal.ts` (or similar)
-   Add `AnalysisInsights` interface.

**Step 3.2: Analyst Component**
-   **File**: `frontend/src/components/journal/JournalAnalystWidget.tsx`
-   Use `@headlessui/react` Tabs.
-   **Tab 1: Clinical Assessment**: Render markdown of Pass 2.
-   **Tab 2: Podcast Script**: Render text of Pass 3 (whitespace preserved).
-   **Tab 3: Raw Data**: Debug view (optional).
-   **Style**: Use `Mesa` theme colors (Terracotta/Petrol).

**Step 3.3: Integration**
-   **File**: `frontend/src/pages/JournalPage.tsx`
-   Render `JournalAnalystWidget` below the Scorecards and before the "Delete" button.
