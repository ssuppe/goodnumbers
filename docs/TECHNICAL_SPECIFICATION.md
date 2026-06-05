# Technical Specification: Goodnumbers Weekly Health Journal

**Version:** 1.4 (Updated post-Statistical Insights)
**Date:** 2026-04-16
**Status:** Revised to reflect current codebase

## 1. Introduction

This document provides a comprehensive technical specification for the Goodnumbers application. Goodnumbers is an experimental weekly health journal designed to help Type 1 Diabetics reflect on and improve their blood glucose management. It combines statistical analysis of CGM data with structured insights to create a supportive and motivating user experience.

## 2. Requirements

### 2.1. Functional Requirements

#### 2.1.1. User Authentication (Auth.js)

- **Access Control:** Access is restricted via an **email allowlist**. Only users whose email is on a server-side list can successfully register or sign in.
- **Provider:** Credentials (Username/Password). Google OAuth has been removed in favor of a self-hosted, simplified approach.
- **Password Hashing:** Passwords are securely hashed using Node.js native `crypto.scryptSync` with hardened parameters (N: 16384, r: 8, p: 1, maxmem: 32MB) to prevent hardware-accelerated brute forcing.
- **UI:** Custom Frontend pages (`/login` and `/register`) provide the authentication interface.
- **Onboarding Flow:**
  1.  User registers with an allowed email and a password.
  2.  **Agreements:** User must sign terms and privacy policy (`agreementsSigned` flag).
  3.  **Setup:** User must provide Nightscout credentials (`nightscoutUrl`).

#### 2.1.2. Journal Generation

- **Trigger:** User clicks "Start Journal" on the Dashboard.
- **Process:** A background job (BullMQ) is enqueued.
- **Worker Logic:**
  1.  **Fetch Data:** Fetch 7 days of entries, treatments, and profile from Nightscout.
  2.  **AGP Generation:** Calculate AGP metrics (Median, Percentiles) for the chart.
  3.  **Scorecard Metrics:** Calculate Voyager Scorecard metrics (Avg Glucose, Stability, Time in Range, Time in Tight Range) and compare with previous weeks for trends.
  4.  **Hotspot Detection:** Detect "Hotspots" (clusters of glycemic events) using the `HotspotDetector` engine.
      - **Timezone Awareness:** Clusters are automatically split if they span different UTC offsets, ensuring travelers see patterns grouped by location.
      - **Metadata Capture:** Each cluster captures its local IANA timezone name and UTC offset for high-fidelity title generation.
  5.  **Statistical Insights:** Execute the deterministic `Insights Engine` to generate aggregate insights:
      - **GMI & TIR:** Standard glycemic metrics.
      - **Overnight Glucose Control:** A specialized heuristic analyzing the 11 PM to 7 AM window against Normal, Tight, and Standard clinical ranges.
  6.  **Persistence:** Persist all results, including normalized treatments, to the database.

#### 2.1.3. Overnight Glucose Control Insight

- **Window:** 11:00 PM to 07:00 AM local time.
- **Minimum Data:** 12 readings (approx. 1 hour) required for generation.
- **Metric Buckets:**
  - **Normal:** 81 - 99 mg/dL (4.5 - 5.5 mmol/L).
  - **Tight:** 70 - 140 mg/dL (3.9 - 7.8 mmol/L).
  - **Standard:** 70 - 180 mg/dL (3.9 - 10.0 mmol/L).
- **Majority Logic:** A tier is achieved if $\ge$ 70% of overnight readings fall within the range.
- **Copy:** Includes a multi-metric transparency string `(X% Normal, Y% Tight, Z% Standard)` and actionable targets for the next level of stability.

## 3. Architecture

- **Web Server:** Express.js.
- **Background Worker:** Node.js process managed by BullMQ.
- **Queue:** Redis.
- **Database:** SQLite with Prisma ORM.
- **Visualization Engine:** **Apache ECharts** using the **Canvas renderer** for industrial-grade stability and complex piecewise highlighting.
- **Shared Packages:** Strictly layered unidirectional flow:
  - `@goodnumbers/types`: Pure TS interfaces/enums (Zero dependencies).
  - `@goodnumbers/schemas`: Zod validation definitions (Depends on `types`).
  - `@goodnumbers/common`: Shared logic and utilities (Depends on `schemas` and `types`).

### 4. Data Handling

### 4.1. Database Architecture

The project uses **SQLite** for all environments (Local Dev, Docker, and Production). This choice simplifies deployment and allows for seamless data portability.

- **Storage**: The database file is located at `backend/prisma/dev.db`.
- **Syncing**: The `justfile` includes interactive prompts to allow syncing the local development database to the production VPS during deployment (`just deploy`) or resetting it during local Docker testing (`just docker-prod`).
- **ORM**: Prisma is used for schema management and type-safe database access.

### 4.2. Prisma Schema

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
  clusterDataJson     Json      // Full cluster data + Timezone/Offset metadata
  userNotes           String?
  insights            Json?     // Statistical insights (Zod validated)
}
```

### 4.3. Visualization & Analysis Strategy

- **ECharts Canvas Renderer**: Switched from SVG to Canvas to eliminate coordinate calculation crashes during complex multi-segment rendering.
- **Value-Based Scanner**: Frontend performs a high-fidelity "Value Scan" on every reading. Any point above 10 mmol/L or below 3.9 mmol/L is rendered solid/opaque, even if it falls outside an "official" behavioral event window.
- **Sequential Piecewise Gradients**: `visualMap` is implemented with strictly non-overlapping pieces and explicit gap-filling to ensure stable coordinate lookup and perfect chronological sorting.

### 4.2. Flexible JSON Fields

- `agpChartData`: Array of `AgpDataPoint` objects.
- `scoreCardData`: Object containing metrics and `trends`.
- `treatments`: Array of normalized treatment objects (carbs, insulin).
- `analysisInsights`: Array of `Insight` objects (Priority, Note).

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

## 6. Security Measures

- **Encryption:** `nightscoutToken` is encrypted at rest using AES-256-GCM.
- **CSRF:** Implemented via `tiny-csrf` with a token endpoint.
- **Rate Limiting:** Applied to all API routes.
- **Input Validation:** Zod schemas used for all API inputs and internal JSON storage.
- **Data Segregation:** All DB queries filter by `userId`.

## 7. Future Work / Known Limitations

- **AI/Insights:** Gemini 3.1 Pro and Flash are fully integrated into the backend worker to provide clinical reasoning and executive summaries.
- **RSS Token:** The regeneration endpoint is not yet implemented.
