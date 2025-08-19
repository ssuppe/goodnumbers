# Data Model Specification

**Version:** 1.0
**Date:** 2025-08-12

## 1. Overview

This document provides a detailed specification for the database schema of the Goodnumbers application. It is designed to be used by software engineers for implementation. The schema is defined using the Prisma ORM syntax and is intended for use with a SQLite database.

The data model is designed to be robust and scalable, while also providing flexibility for features that are expected to evolve during prototyping, as per the project's development philosophy.

## 2. Prisma Schema Definition

Below is the complete Prisma schema (`schema.prisma`) that defines all data models, fields, and relationships.

```prisma
// file: prisma/schema.prisma

// Enum for type safety on user's preferred glucose units
enum GlucoseUnit {
  MGDL
  MMOL
}

// --- Core Application Models ---

model User {
  id              String    @id @default(cuid())
  name            String?
  email           String?   @unique
  emailVerified   DateTime?
  image           String?
  accounts        Account[]
  sessions        Session[]
  journals        Journal[]

  // Application-specific settings
  nightscoutUrl   String?
  nightscoutToken String?
  preferredUnits  GlucoseUnit @default(MGDL)
  rssToken        String    @unique @default(cuid())
}

model Journal {
  id                   String    @id @default(cuid())
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  userId               String
  user                 User      @relation(fields: [userId], references: [id])

  // Job progress tracking
  status               String    @default("PENDING")
  progress             Int       @default(0)
  statusMessage        String?

  // User-provided subjective inputs
  weeklyVibe           String?
  influencingFactors   Json?
  goalsForNextWeek     String?

  // AI-generated content
  podcastTitle         String?
  podcastDescription   String?
  podcastAudioUrl      String?
  agpChartData         Json?
  analysisInsights     Json?

  // Relation to detailed analysis
  clusters             GlycemicEventCluster[]
}

model GlycemicEventCluster {
  id                  String    @id @default(cuid())
  journalId           String
  journal             Journal   @relation(fields: [journalId], references: [id])

  // Cluster summary data
  eventType           String
  eventCount          Int
  meanTimeMinutes     Int

  // Detailed data and user notes
  clusterDataJson     Json
  userNotes           String?
}


// --- Standard Auth.js Models ---

model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

## 3. Model & Field-Level Documentation

### 3.1. `User` Model

Stores information about a registered user, including their identity, application settings, and authentication details.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `String` | Unique identifier for the user (CUID). Primary Key. |
| `name` | `String?` | User's display name. Sourced from Google profile via Auth.js. |
| `email` | `String?` | User's email address. Sourced from Google profile via Auth.js. |
| `emailVerified` | `DateTime?` | Timestamp for when the user's email was verified. Managed by Auth.js. |
| `image` | `String?` | URL to the user's profile picture. Sourced from Google profile via Auth.js. |
| `accounts` | `Account[]` | Relation to the `Account` model for Auth.js. |
| `sessions` | `Session[]` | Relation to the `Session` model for Auth.js. |
| `journals` | `Journal[]` | One-to-many relation to the journals created by this user. |
| `nightscoutUrl` | `String?` | **Source:** PRD "Setup Account". Stores the URL of the user's Nightscout instance. |
| `nightscoutToken` | `String?` | **Source:** PRD "Setup Account". Stores the user's Nightscout API token. **Implementation Note:** This value MUST be encrypted at the application layer before being stored in the database, as specified in the Technical Design. |
| `preferredUnits` | `GlucoseUnit` | **Source:** PRD "Setup Account". Stores the user's preferred glucose measurement unit. Defaults to `MGDL`. |
| `rssToken` | `String` | **Source:** PRD "Podcast Page". A secure, unique token for generating the user's private podcast RSS feed URL. **Implementation Note:** This is generated automatically by the database (`@default(cuid())`) upon user creation. |

### 3.2. `Journal` Model

Represents a single weekly journal entry for a user. It tracks the generation process, stores user inputs, and holds the final generated content.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `String` | Unique identifier for the journal (CUID). Primary Key. |
| `createdAt` | `DateTime` | Timestamp of when the journal record was created. |
| `updatedAt` | `DateTime` | Timestamp of the last update to the journal record. |
| `userId` | `String` | Foreign key linking to the `User` who owns this journal. |
| `status` | `String` | Tracks the background job status. Values: `PENDING`, `ANALYZING_DATA`, `DRAFTING_INSIGHTS`, `GENERATING_AUDIO`, `COMPLETE`, `FAILED`. |
| `progress` | `Int` | A percentage (0-100) representing the progress of the generation job. To be displayed on the frontend loading screen. |
| `statusMessage` | `String?` | A user-friendly message corresponding to the current `status` (e.g., "Analyzing your data..."). |
| `weeklyVibe` | `String?` | **Source:** PRD "This week's journal". Stores the user's subjective feeling for the week (e.g., "Wilted", "Sprouting"). |
| `influencingFactors` | `Json?` | **Source:** PRD "This week's journal". Stores an array of strings representing factors that influenced the user's week (e.g., `["Busy", "Poor Sleep"]`). |
| `goalsForNextWeek` | `String?` | **Source:** PRD "This week's journal". A text field for the user to set their goals for the upcoming week. |
| `podcastTitle` | `String?` | The AI-generated title for the weekly podcast summary. |
| `podcastDescription` | `String?` | The AI-generated description for the podcast episode. |
| `podcastAudioUrl` | `String?` | The URL to the generated MP3 audio file for the podcast. |
| `agpChartData` | `Json?` | Stores the data points required to render the Ambulatory Glucose Profile (AGP) chart. |
| `analysisInsights` | `Json?` | Stores an array of AI-generated insight objects. See Section 4 for the recommended data structure. |
| `clusters` | `GlycemicEventCluster[]` | One-to-many relation to the detailed glycemic patterns found in this journal. |

### 3.3. `GlycemicEventCluster` Model

Represents a specific, recurring pattern of high or low glycemic events detected during the analysis of a journal's data.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `String` | Unique identifier for the cluster (CUID). Primary Key. |
| `journalId` | `String` | Foreign key linking to the parent `Journal`. |
| `eventType` | `String` | The type of event in the cluster (e.g., `HIGH_AFTER_UNCOVERED_MEAL`, `HYPOGLYCEMIA`). |
| `eventCount` | `Int` | The number of individual events that form this cluster. |
| `meanTimeMinutes` | `Int` | The average time of day (in minutes from midnight) around which these events occur. |
| `clusterDataJson` | `Json` | The full, detailed `TimeCluster` object from the analysis pipeline, containing all data points for visualization. |
| `userNotes` | `String?` | **Source:** PRD "Glycemic Event Cluster Analysis". A text field for the user to record their own reflections about this specific pattern. |

### 3.4. Auth.js Models (`Account`, `Session`, `VerificationToken`)

These are standard models required by the Auth.js library to manage OAuth connections, user sessions, and other authentication flows. Their structure should not be modified. The `VerificationToken` model will not be used in the MVP but is included for completeness.

## 4. Strategy for Flexible JSON Fields

The `Journal` model contains two `Json` fields: `agpChartData` and `analysisInsights`. The `GlycemicEventCluster` model contains `clusterDataJson`. This design choice provides flexibility during prototyping.

For the `analysisInsights` field specifically, the following best-practice approach was decided upon:

1.  **Flexible Database:** The schema will remain `Json?`, allowing the backend analysis service to iterate on the insight structure without requiring database migrations.
2.  **Strict Application-Level Contract:** The API endpoint that serves journal data to the frontend will be responsible for validating the structure of the `analysisInsights` data. This should be implemented using a schema validation library (e.g., Zod).

The validation schema should enforce that each insight object in the array contains, at a minimum:
*   `level`: A string matching one of the defined insight levels (e.g., 'CRITICAL', 'IMPORTANT').
*   `text`: The string content of the insight.

This ensures the frontend can reliably render the insights according to the taxonomy defined in the PRD, while still allowing for rapid backend development.
