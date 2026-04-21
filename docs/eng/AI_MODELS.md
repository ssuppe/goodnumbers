# AI Model Configuration (State of the Truth)

As of April 20, 2026, the following models are configured as the standard for production and development:

## Core Models

- **Reasoning/Clinical Assessment:** `gemini-3.1-pro-preview`
- **Fast Fallback/Summarization:** `gemini-3.1-flash-preview`

## Configuration Standards

To ensure consistent integration with the frontend, all model instances must be configured with structured JSON output:

```typescript
generationConfig: {
  responseMimeType: "application/json";
}
```

## Revision History

- **2026-04-20:** Confirmed Gemini 3.1 series as SOTS. Reverted from 1.5 versions which caused "AI assessment unavailable" errors in the current environment. Enforced strict JSON MIME type for parsing reliability.
