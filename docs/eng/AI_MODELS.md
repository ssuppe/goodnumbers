# AI Model Configuration (State of the Truth)

As of October 2026, models are decoupled into environment-configurable tiers in `backend/src/lib/ai/gemini.ts` to support seamless drop-in upgrades (e.g. Gemini 4 Argon):

## Core Models & Allocations

### 1. Flagship Reasoning Tier (`GEMINI_REASONING_MODEL`)

- **Default Model:** `gemini-3.1-pro-preview` (configurable via `process.env.GEMINI_REASONING_MODEL`)
- **Allocated To:**
  - **Clinical Assessment:** `generateClusterAIInsight` (root cause, probable driver, exploratory reflection prompts).
  - **Quick Coach Story Generator:** `generateQuickCoachStory` (pre-generated asynchronously during BullMQ worker execution for deep clinical narratives and precise D3 canvas animation cues).
  - **Quick Coach Voice Negotiation & Tool Loop:** `generateChatResponse` (multi-turn Nightscout tool calling agent).
  - **Micro-Goal Synthesis:** `synthesizeChatInsight` (synthesizing conversational consensus into 1-sentence action habits).

### 2. Fast Execution & Fallback Tier (`GEMINI_FLASH_MODEL`)

- **Default Model:** `gemini-3.8-flash` (configurable via `process.env.GEMINI_FLASH_MODEL`)
- **Allocated To:**
  - **Executive AGP Summaries:** `generateExecutiveSummary` (structured highlights cards).
  - **Journal Titles:** `generateJournalTitle` (concise evocative week titles).
  - **Automatic Fallback Circuit-Breaker:** Instantaneous fallback when the reasoning model encounters 503s, rate limits, or transient connection drops during tool loops or story generation.

## Gemini 4 Argon Roadmap

- **Status:** Announced September 30, 2026. Currently in phased rollout via Google's Fairwind Program for trusted testers.
- **Drop-in Readiness:** Because models are decoupled from hardcoded strings, transitioning Quick Coach and clinical assessment to Gemini 4 Argon requires only setting:
  ```env
  GEMINI_REASONING_MODEL=gemini-4-pro
  ```
  in `.env` with no code refactoring necessary.

## Latency & UX Mitigations for High-Reasoning Models

Because Pro models take longer on multi-turn tool loops:

1. **Progressive Thinking UX:** The frontend (`QuickCoachVoiceNegotiation.tsx`) dynamically cycles through transparent thinking phases (_"Analyzing pattern..."_ &rarr; _"Investigating historical data..."_ &rarr; _"Synthesizing clinical coaching..."_) to eliminate the silence anxiety of conversational voice interactions.
2. **Interactive Retry:** Errors display a non-blocking retry button allowing users to re-submit with one tap rather than losing conversation state.
3. **Flash Fallback:** Backend tool loops catch reasoning failures and transparently fall back to `gemini-3.8-flash`.

## Revision History

- **2026-10-03:** Upgraded fast model baseline from `gemini-3-flash-preview` to `gemini-3.8-flash`. Parameterized model constants (`GEMINI_REASONING_MODEL`, `GEMINI_FLASH_MODEL`) via environment variables. Allocated flagship reasoning model to Quick Coach stories and voice negotiation with progressive thinking UX and fallback circuit breaker.
- **2026-04-20:** Confirmed Gemini 3.1 series as SOTS. Reverted from 1.5 versions which caused "AI assessment unavailable" errors in the current environment. Enforced strict JSON MIME type for parsing reliability.
