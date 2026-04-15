# Technical Specification: Goodnumbers Weekly Health Journal

**Version:** 1.3 (Updated post-implementation)
**Date:** 2025-10-23
**Status:** Revised to reflect current codebase

## 1. Introduction

This document provides a comprehensive technical specification for the Goodnumbers application. Goodnumbers is an experimental weekly health journal designed to help Type 1 Diabetics reflect on and improve their blood glucose management. It combines statistical analysis of CGM data with structured insights to create a supportive and motivating user experience.

## 2. Requirements

### 2.1. Functional Requirements

#### 2.1.1. User Authentication (Auth.js)

- **Access Control:** Access is restricted via an **email allowlist**. Only users whose Google account email is on a server-side list can successfully sign in.
- **Provider:** Google OAuth is the sole authentication method.
- **UI:** Auth.js built-in pages are used.
- **Onboarding Flow:**
  1.  User signs in with Google.
  2.  **Agreements:** User must sign terms and privacy policy (`agreementsSigned` flag).
  3.  **Setup:** User must provide Nightscout credentials (`nightscoutUrl`).

#### 2.1.2. Journal Generation

- **Trigger:** User clicks "Start Journal" on the Dashboard.
- **Process:** A background job (BullMQ) is enqueued.
- **Worker Logic:**
  1.  Fetch 7 days of entries, treatments, and profile from Nightscout.
  2.  Calculate AGP metrics (Median, Percentiles).
  3.  Calculate Voyager Scorecard metrics (Avg Glucose, Stability, Time in Range, Time in Tight Range).
  4.  Detect "Hotspots" (clusters of glycemic events) using the `HotspotDetector` engine.
  5.  Persist all data to the database.

## 3. Architecture

- **Web Server:** Express.js.
- **Background Worker:** Node.js process managed by BullMQ.
- **Queue:** Redis.
- **Database:** SQLite with Prisma ORM.
- **Shared Packages:** Strictly layered unidirectional flow:
  - `@goodnumbers/types`: Pure TS interfaces/enums (Zero dependencies).
  - `@goodnumbers/schemas`: Zod validation definitions (Depends on `types`).
  - `@goodnumbers/common`: Shared logic and utilities (Depends on `schemas` and `types`).

## 4. Data Handling

### 4.1. Prisma Schema

```prisma
model User {
  id                   String    @id @default(cuid())
  name                 String?
  email                String?   @unique
  emailVerified        DateTime?
  image                String?
  accounts             Account[]
  sessions             Session[]
  journals             Journal[]

  // Onboarding & Settings
  agreementsSigned     Boolean   @default(false)
  nightscoutUrl        String?
  nightscoutToken      String?   // Encrypted
  nightscoutTokenLast3 String?   // Hint for UI
  preferredUnits       GlucoseUnit @default(MGDL)
  rssToken             String    @unique @default(cuid())
}

model Journal {
  id                   String    @id @default(cuid())
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  userId               String
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Job progress tracking
  status               String    @default("PENDING")
  progress             Int       @default(0)
  statusMessage        String?

  // User-provided subjective inputs
  weeklyVibe           String?
  influencingFactors   Json?
  goalsForNextWeek     String?

  // AI & Analysis Content
  podcastTitle         String?
  podcastDescription   String?
  podcastAudioUrl      String?
  agpChartData         Json?
  analysisInsights     Json?
  treatments           Json?     // Stored treatments for the week
  scoreCardData        Json?     // Voyager metrics (TIR, GMI, etc.)

  // Relation to detailed analysis
  clusters             GlycemicEventCluster[]
}

model GlycemicEventCluster {
  id                  String    @id @default(cuid())
  journalId           String
  journal             Journal   @relation(fields: [journalId], references: [id], onDelete: Cascade)

  eventType           String
  eventCount          Int
  meanTimeMinutes     Int
  clusterDataJson     Json      // Full cluster data for charts
  userNotes           String?
}
```

### 4.2. Flexible JSON Fields

- `agpChartData`: Array of `AgpDataPoint` objects.
- `scoreCardData`: Object containing `avgGlucose`, `stability`, `timeInRange`, `timeInTightRange` and `trends`.
- `treatments`: Array of normalized treatment objects (carbs, insulin).

## 5. API Design

All endpoints require authentication (`protect`) and CSRF protection.

- **`GET /api/csrf-token`**: Returns a CSRF token.

- **`POST /api/journals`**: Enqueues a new journal generation job.
- **`GET /api/journals/:id/status`**: Polls the status of a job.
- **`GET /api/journals`**: Lists journal summaries.
- **`GET /api/journals/:id`**: Fetches full journal data.
- **`PUT /api/journals/:id`**: Updates user inputs (vibe, goals, notes).
- **`DELETE /api/journals/:id`**: Deletes a journal.

- **`PUT /api/user/settings`**: Updates Nightscout credentials and units.
  - Note: `nightscoutToken` is encrypted before storage. `nightscoutTokenLast3` is stored as a hint.

## 6. Security Measures

- **Encryption:** `nightscoutToken` is encrypted at rest using AES-256-GCM (`backend/src/lib/encryption.ts`).
- **CSRF:** Implemented via `tiny-csrf` with a token endpoint.
- **Rate Limiting:** Applied to all API routes, with stricter limits on `POST /journals` and `PUT /settings`.
- **Input Validation:** Zod 4.3.5 schemas used for all API inputs (shared via `@goodnumbers/schemas`). Version is pinned monorepo-wide to ensure type safety.
- **Package Security:** All shared packages are marked `private: true` to prevent dependency confusion attacks.
- **Data Segregation:** All DB queries filter by `userId`.

## 7. Future Work / Known Limitations

- **AI/Podcast:** The schema supports AI-generated content (`podcastAudioUrl`, `analysisInsights`), but the backend integration with Gemini/TTS is currently a placeholder or pending implementation in the worker.
- **RSS Token:** The `rssToken` field exists on the User model, but the endpoint to regenerate it (`POST /api/user/regenerate-rss-token`) is not yet implemented.
