# Technical Specification: Goodnumbers Weekly Health Journal

**Version:** 1.2
**Date:** 2025-08-16
**Status:** Final

## 1. Introduction

This document provides a comprehensive technical specification for the Goodnumbers application. Goodnumbers is an experimental weekly health journal designed to help Type 1 Diabetics reflect on and improve their blood glucose management. It combines statistical analysis of CGM data with AI-driven insights and a personalized audio podcast to create a supportive and motivating user experience.

The goal of this specification is to provide a developer-ready document that outlines the architecture, data models, APIs, and functional requirements necessary to implement the Minimum Viable Product (MVP). The system is designed to be self-hosted on a single machine using a robust, open-source technology stack.

## 2. Requirements

### 2.1. Functional Requirements

#### 2.1.1. Pre-Release Access Barrier
- **Goal:** Restrict site-wide access to a pre-approved list of beta testers before they can reach the main application's login page.
- **Mechanism:** An Express.js middleware will be applied to all routes to intercept all incoming requests and check the user's authorization status.
- **Session Management:**
    - **Library:** The barrier will use the `cookie-session` Express middleware. This library is chosen for its simplicity, as it stores session data directly on the client in a secure, signed cookie, avoiding the need for server-side session storage.
    - **Configuration:**
        - **Name:** The cookie will be named `barrier_session`.
        - **Secret:** The cookie will be cryptographically signed with a secret key. This key MUST be provided to the application via a `COOKIE_SECRET` environment variable.
        - **Options:** The cookie will be configured with security best practices in mind: it will be `httpOnly` (to prevent access from client-side scripts), `secure` (to ensure it is only sent over HTTPS in a production environment), `sameSite: 'lax'` (to provide CSRF protection), and will have a `maxAge` of 7 days (specified in milliseconds) to control the session duration.
- **User Experience Flow:**
    1. When a user first accesses any page, the barrier middleware checks for a valid, trusted `barrier_session` cookie.
    2. If the cookie is invalid or absent, the user is immediately redirected to `/barrier-login.html`.
    3. For the initial implementation, `/barrier-login.html` will be a static HTML file containing a simple placeholder message and a basic form. The full, styled UI will be built in a later phase (Phase 4).
    4. A user can submit their credentials via the form on this page, which sends a `POST` request to the `/api/barrier-login` endpoint.
    5. On successful login, the `barrier_session` cookie is created and sent to the user's browser, and they are redirected to their originally requested URL.
    6. On failure, an error is returned from the API, and the frontend will be responsible for displaying it.
- **Credential Management:**
    - The shared username and password for the barrier MUST be supplied via server-side environment variables to avoid hardcoding sensitive data.
    - **Variable Names:** The application will expect the following environment variables to be present:
        - `BARRIER_USERNAME`
        - `BARRIER_PASSWORD`
- **Health Check Exclusion:** Requests to the `/health` endpoint are explicitly excluded from the barrier and are publicly accessible.

#### 2.1.2. User Authentication (Auth.js)
- **Provider:** Google OAuth is the sole and primary authentication method for the MVP.
- **UI:** Auth.js built-in pages will be used for the login/registration flow.
- **Authentication and Agreement Flow:** The system handles all users through a unified, stateful flow.
    1. **Google Sign-In:** A user (whether new or returning) signs in with Google. Upon successful authentication, the Auth.js Prisma adapter finds or creates a `User` record in the database. If the user is new, the `agreementsSigned` field defaults to `false`.
    2. **Agreement Gate:** After sign-in, a mandatory check is performed on every authenticated action. This check, implemented via middleware or Auth.js callbacks, inspects the `agreementsSigned` flag in the user's session data.
    3. **Redirection:** If `agreementsSigned` is `false`, the user is immediately redirected to a dedicated `/agreements` page. They cannot access any other part of the application.
    4. **Agreement Page:** On this page, the user is presented with the "Terms and Conditions" and "Privacy Policy" checkboxes. The "Continue to Dashboard" button is disabled until both are checked.
    5. **Consent Persistence:** When the user checks the boxes and clicks the "Continue" button, a specific API call is made (e.g., `POST /api/user/sign-agreements`) which sets the `agreementsSigned` flag to `true` in the database.
    6. **Dashboard Access:** Once the flag is true, the user is redirected to the Dashboard. On all subsequent visits, the check in Step 2 will pass, and they will proceed directly to the application without seeing the agreements page again.
- **Session Management:**
    - If an authenticated user visits the login page, they are redirected to the Dashboard.
    - Secure sessions are managed by Auth.js.
    - A "Logout" button must be available in the authenticated header.

#### 2.1.3. Homepage
- A static, public-facing page that describes the application's value proposition.
- Contains a "See a demo" button linking to the Demo Page.
- Contains a "Login / Register" button linking to the Auth.js login page.
- Includes a persistent, non-dismissible banner with the medical use disclaimer.
- Must be fully mobile-responsive.

#### 2.1.4. Account Setup
- **Trigger:** This is the first page a user sees after their initial login and agreement.
- **Fields:**
    - CGM Provider: A dropdown, initially containing only "Nightscout".
    - Nightscout URL: Text input.
    - Nightscout Token: Text input (password type).
    - Preferred Units: Radio buttons for "mg/dL" or "mmol/L".
- **Connection Flow:**
    1. A "Test Connection" button validates the provided Nightscout credentials.
    2. A "Save and Continue" button is disabled by default.
    3. On successful connection test, the "Save and Continue" button is enabled.
    4. On failure, a clear error message is displayed.
    5. Clicking "Save and Continue" persists the settings and redirects to the Dashboard.

#### 2.1.5. Dashboard
- **Primary Action Card ("Log this week's journal"):**
    - Styled as a prominent "hero" component.
    - The "Start Journal" button is enabled only if it has been 3+ days since the last journal was created or if no journals exist.
    - When disabled, it displays a message like "Your next journal unlocks on [Date]".
- **Historical Journals ("Past weeks"):**
    - A list of past journals in reverse chronological order.
    - Each journal is a card displaying its date, title, and a truncated description.
    - Each card has a "View" button to navigate to the full journal page.
    - This section is hidden if no past journals exist.

#### 2.1.6. Journal Generation Process
- **Trigger:** User clicks the "Start Journal" button on the Dashboard.
- **User Experience:**
    - User is navigated to a synchronous loading screen.
    - A progress bar and descriptive text show the status (e.g., "Fetching Data", "Statistical Analysis", "AI Scripting", "Audio Generation").
    - Upon completion, the user is redirected to the newly created journal page.
- **Backend Process:** A background job is initiated to:
    1. Fetch the last 7 days of blood glucose and treatment data from the user's Nightscout.
    2. Run statistical analysis to identify trends, hotspots, and generate structured "Notes".
    3. Execute a multi-pass AI pipeline (using Gemini) to generate an in-depth assessment, a podcast script, and an RSS feed description.
    4. Synthesize the podcast audio using a Text-to-Speech service.
    5. Update the journal record in the database with all generated content.

#### 2.1.7. Journal Page ("This week's journal")
- **State:** All user-input fields are always editable. AI-generated content is immutable.
- **Layout:** A vertical, narrative-driven page.
- **Components:**
    - **Personalized Podcast Player:** Displays title and description. Lazily loads the audio player on click. Collapses to a sticky, compact player at the top of the viewport on scroll.
    - **Ambulatory Glucose Profile (AGP) Chart:** A detailed, interactive chart visualizing the week's glucose data (median, percentiles) against the user's target range. Includes a "spotlight" hover effect and detailed tooltips. Must be mobile-responsive.
    - **AI-Generated Insights:** A list of prioritized insights (Critical, Serious, Important, Info) with corresponding icons and colors.
    - **Subjective Inputs:**
        - "Weekly Vibe": Tappable cards with emojis (🥀, 🌱, 🌿, 🌻).
        - "Influencing Factors": Categorized, tappable chips for factors like sleep, diet, and stress.
    - **Glycemic Event Cluster Analysis:** For each detected pattern, a dedicated card displays a summary, an interactive visualization, associated insights, and a "User Notes" textarea.
    - **Goals for Next Week:** A distinct card with a text area for the user to write their goals.
    - **Save Action Bar:** A floating bar at the bottom of the screen with an always-enabled "Save and Close" button. Provides "Saving..." feedback on click.

#### 2.1.8. Historical Journals
- Viewing a historical journal uses the same page/layout as "This week's journal".
- User can edit their subjective inputs (vibe, factors, notes, goals) and save changes.
- A "Delete" icon is present. On click, a confirmation dialog appears before permanent deletion.

#### 2.1.9. Demo Page
- A read-only version of the journal page populated with static, pre-generated data.
- All user input fields are disabled.
- A prominent banner explains it's a demo and includes a "Sign up" call to action.

#### 2.1.10. Podcast Page
- Accessible from the authenticated header.
- Displays the user's unique, private RSS feed URL.
- Includes a "Copy" button and a brief explanation of how to use the URL in a podcast app.
- Includes a "Regenerate URL" button. When clicked, a confirmation dialog should appear. On confirmation, the backend generates a new `rssToken` for the user, invalidating the old URL.

### 2.2. Non-Functional Requirements
- **Security:**
    - All data in transit must be encrypted (HTTPS/SSL).
    - System must be protected against common web vulnerabilities (XSS, CSRF).
    - Sensitive credentials (`nightscoutUrl`, `nightscoutToken`) MUST be encrypted at rest.
    - Rate limiting should be applied to authentication and journal creation endpoints.
- **Performance:**
    - Pages should load in < 2 seconds on average networks.
    - API responses should be < 1 second.
    - The resource-intensive journal generation process must not block the main web server.
- **Usability & Accessibility:**
    - The application must be intuitive and easy to use.
    - It must be fully mobile-responsive.
    - It should adhere to WCAG 2.1 AA guidelines where possible.
- **Scalability & Reliability:**
    - The system must handle a growing number of users.
    - The authentication and journal systems must be highly available and resilient.

## 3. Architecture

The system is a monolithic application designed to run in a single Docker container, managed by `pm2` to run two concurrent processes.

- **Web Server Process (Express.js):** Handles all user-facing HTTP requests, serves the React frontend, manages authentication via Auth.js, and exposes the REST API.
- **Background Worker Process (Node.js):** Executes the long-running journal generation jobs. It is completely decoupled from the web server to ensure the UI remains responsive.
- **Job Queue (BullMQ):** A Redis-backed queue that mediates between the web server and the background worker. When a user starts a new journal, the web server enqueues a job, which the worker then picks up for processing.
- **Database (SQLite):** A single SQLite database file provides persistent storage. It will be configured to run in Write-Ahead Logging (WAL) mode to handle concurrent access from the web and worker processes.
- **Deployment:** The entire application (web server, worker, Redis) is containerized with Docker and deployed on a single Google Compute Engine (GCE) instance.

### 3.1. Analysis Pipeline
The backend analysis pipeline processes raw Nightscout data into insights.
1.  **Data Preparation (`gn-autotune-prep.ts`):** Raw data is cleaned and structured.
2.  **Event Detection (`detect_events.ts`):** Individual glycemic events (e.g., `HYPOGLYCEMIA`) are identified.
3.  **Event Classification (`event_classifier.ts`):** Events are given context (e.g., `HIGH_AFTER_UNCOVERED_MEAL`).
4.  **Time-Based Clustering (`time_clustering.ts`):** Classified events are grouped by time of day into recurring patterns (`TimeCluster` objects), which are then stored.

## 4. Data Handling

The data model is defined using Prisma ORM for a SQLite database.

### 4.1. Prisma Schema

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

### 4.2. Model Documentation

- **User:** Stores user identity, Auth.js relations, and application-specific settings like encrypted Nightscout credentials and the private RSS token. The `rssToken` can be regenerated by the user via the API.
- **Journal:** The central model for a weekly entry. It tracks the background generation job's status, stores all user inputs, and holds references to the AI-generated content (podcast URL, chart data, insights).
- **GlycemicEventCluster:** Represents a specific, recurring pattern of high or low blood sugar. It stores summary data for querying and the full, detailed analysis object (`TimeCluster`) as JSON for visualization.
- **Auth.js Models:** Standard `Account`, `Session`, and `VerificationToken` models required by Auth.js.

### 4.3. Flexible JSON Fields
The `analysisInsights` and `clusterDataJson` fields use the `Json` type to allow for rapid iteration on the analysis pipeline without requiring database migrations. The API layer is responsible for validating the structure of this data (e.g., using Zod) before sending it to the frontend, ensuring a strict contract with the client.

## 5. API Design

All endpoints are protected by authentication middleware.

- **`POST /api/barrier-login`**
  - **Purpose:** Authenticates a user for the pre-release beta access barrier.
  - **Request Body:** The endpoint expects a JSON body with the following structure, which must be validated using `zod`: `{ "username": "string", "password": "string" }`
  - **Security:**
      - **Rate Limiting:** This endpoint MUST be protected by a strict rate limiter (e.g., using `express-rate-limit`) to prevent brute-force password guessing attacks.
      - **Constant-Time Comparison:** Credential comparison MUST be performed using a constant-time algorithm (e.g., Node.js's `crypto.timingSafeEqual`) to mitigate timing attacks.
  - **Logic:**
      1.  The handler receives the `username` and `password` from the request body.
      2.  It securely compares these values against the `BARRIER_USERNAME` and `BARRIER_PASSWORD` environment variables using a constant-time comparison.
      3.  **On Success:** If the credentials match, it sets a property on the session object (e.g., `req.session.is_authorized = true`). The `cookie-session` middleware then automatically sends the updated, signed cookie to the client in the response headers. The endpoint returns a `200 OK` status with a success message.
      4.  **On Failure:** If the credentials do not match, it returns a `401 Unauthorized` status with an error message. It does not provide specifics on whether the username or password was incorrect.

- **`POST /api/journals`**
  - **Purpose:** Initiates the generation of a new weekly journal.
  - **Logic:** Creates a `Journal` record and enqueues a job in BullMQ for the background worker.
  - **Security:** Requires anti-CSRF token.

- **`GET /api/journal-status/:id`**
  - **Purpose:** Allows the client to poll for the progress of a journal being generated.
  - **Logic:** Returns the `status`, `progress`, and `statusMessage` fields for the specified journal.
  - **Security:** Enforces ownership check; a user can only query the status of their own journals.

- **`GET /api/journals`**
  - **Purpose:** Fetches a summarized list of all completed journals for the user's dashboard.
  - **Logic:** Returns an array of `Journal` objects for the authenticated user, ordered newest first.

- **`GET /api/journals/:id`**
  - **Purpose:** Fetches the complete data for a single journal report.
  - **Logic:** Returns the full `Journal` object, including its related `GlycemicEventCluster` records.
  - **Security:** Enforces ownership check.

- **`PUT /api/journals/:id`**
  - **Purpose:** Updates a journal with user-provided notes and subjective inputs.
  - **Request Body:** `{ "weeklyVibe": "...", "influencingFactors": [...], "goalsForNextWeek": "...", "clusterNotes": { "clusterId1": "note1", ... } }`
  - **Security:** Enforces ownership check.

- **`DELETE /api/journals/:id`**
  - **Purpose:** Permanently deletes a journal.
  - **Security:** Enforces ownership check.

- **`PUT /api/user/settings`**
  - **Purpose:** Updates user settings (Nightscout credentials, preferred units).
  - **Request Body:** `{ "nightscoutUrl": "...", "nightscoutToken": "...", "preferredUnits": "MGDL" }`

- **`POST /api/user/regenerate-rss-token`**
  - **Purpose:** Invalidates the old RSS token and generates a new one for the user.
  - **Logic:** Generates a new CUID and updates the `rssToken` field for the authenticated user. Returns the new token.
  - **Security:** Enforces ownership check.

## 6. Error Handling

- **Nightscout Connection Failure:** If the app cannot connect to Nightscout, a persistent, non-dismissible red banner is shown on the Dashboard. The "Start Journal" button is disabled with a tooltip explaining the issue.
- **No Usable CGM Data:** If a user starts a journal but no data is found for the last 7 days, the creation is aborted. A red banner is shown on the Dashboard explaining that no data was found.
- **Insufficient Data Warning:** If < 7 days of data are found, the journal is still generated, but a non-blocking warning banner is displayed at the top of the journal page.
- **Audio File Failure:** If the podcast audio file fails to generate or load, an error message is displayed in place of the audio player.
- **Secure Production Error Handling:** The application MUST include a global error-handling middleware in Express. In a production environment, this middleware MUST prevent leaking technical details or stack traces. It should log the full error server-side for debugging and return a generic, non-revealing error message to the client (e.g., `{"error": "An internal server error occurred."}`).

## 7. Performance Considerations

- **Background Processing:** The expensive journal generation process is offloaded to a background worker via BullMQ to keep the web server responsive.
- **Database Concurrency:** SQLite is configured for WAL mode to allow for safe concurrent reads and writes from the web and worker processes. The following PRAGMAs will be set: `journal_mode = WAL;`, `synchronous = normal;`, `temp_store = memory;`.
- **Lazy Loading:** The podcast audio player on the journal page is lazy-loaded on user interaction to improve initial page load time.
- **Responsive Charts:** Charts will adapt to mobile viewports by reducing label frequency and using compact titles to maintain clarity and performance.

## 8. Security Measures

- **Input Validation:** All API endpoints that accept client-side input (e.g., request bodies, query parameters) MUST use a schema-based validation library (e.g., `zod`) to rigorously validate the data's shape, type, and constraints. This is a primary defense against data corruption and injection attacks.
- **Credential Encryption:** Sensitive user credentials, specifically the `nightscoutUrl` and `nightscoutToken`, will be encrypted at rest in the database.
    - **Method:** Symmetric encryption will be used via Node.js's built-in `crypto` module (AES-256-GCM).
    - **Key Management:** For local development, a 256-bit secret encryption key will be supplied via an `ENCRYPTION_KEY` environment variable. For production, this key SHOULD be managed by a dedicated secrets management service (e.g., Google Secret Manager) and fetched at application startup, rather than being stored in a file on the server.
- **Authentication:** Handled by Auth.js, providing robust session management and protection against common authentication vulnerabilities.
- **CSRF Protection:** API endpoints that modify state (e.g., `POST`, `PUT`, `DELETE`) will use anti-CSRF tokens.
- **Data Segregation:** All database queries enforce ownership checks, ensuring a user can only access their own data.
- **Secure HTTP Headers:** The application MUST use middleware like `helmet` to set various security-related HTTP headers, mitigating common attacks like XSS and clickjacking.
- **Database File Security:** In the production environment, the SQLite database file (`.db`) MUST have its file system permissions configured to be readable and writable only by the application's user account.
- **Pre-Release Barrier:** A site-wide password prevents unauthorized access during the beta phase.

## 9. Testing Plan

- **Unit Testing:**
    - The data analysis and event detection logic (`detect_events.ts`, etc.) should have comprehensive unit tests to ensure correctness.
    - Utility functions (e.g., encryption/decryption) must be unit-tested.
- **Integration Testing:**
    - API endpoints will be tested to verify authentication, authorization, data validation, and correct responses.
    - The "Test Connection" feature for Nightscout setup is a key integration test case.
    - Test the interaction between the web server, BullMQ, and the background worker to ensure jobs are enqueued and processed correctly.
- **End-to-End (E2E) Testing:**
    - Simulate key user flows, such as:
        1. New user registration, including the agreement page.
        2. Setting up a Nightscout connection.
        3. Creating a new journal and waiting on the loading screen.
        4. Interacting with the final journal page (playing the podcast, viewing charts, adding notes).
        5. Editing and deleting a historical journal.

## 10. Implementation Timeline

An implementation timeline is not available from the source documents. This should be developed based on team capacity and priorities.

## 11. Open Questions and Future Considerations

- **[TODO]** Finalize the specific implementation for the private podcast RSS feed generation and hosting.
- **[Future] Monetization:** A freemium model is planned post-MVP, with limitations on the number of saved reports and podcast length for free users.
- **[Future] About Us Page:** A static page to be created.
- **[Future] CGM Provider Expansion:** The system is designed to be modular to support additional CGM providers beyond Nightscout in the future.

## 12. Future Work & Improvements (TODO)

This section lists key areas for improvement identified during the critical analysis phase. They are slated for consideration in future iterations, post-MVP.

- **[TODO] Re-architect for Asynchronous Journal Generation:** The current synchronous flow (making the user wait on a loading screen) is fragile and provides a poor user experience. It is susceptible to network timeouts and provides no resilience if a step in the backend pipeline fails. This should be re-architected to be fully asynchronous: the API should accept the request and return immediately, allowing the user to leave the page while the backend processes the job. The user should be notified of completion via an in-app indicator or email.
- **[TODO] Plan for Database Scalability:** The choice of SQLite, while simple for initial setup, presents a significant long-term scalability and reliability risk. Its file-based locking is not well-suited for highly concurrent access from multiple processes (web server and background worker), which can lead to `SQLITE_BUSY` errors and API failures under load. A formal plan should be created to migrate to a robust client-server database like PostgreSQL to ensure system stability as the user base grows.
- **[TODO] Conduct a Cost Analysis:** A thorough cost analysis of the AI (Gemini) and TTS API calls should be performed to understand the financial viability of the service, especially concerning the planned freemium model.
- **[TODO] Seek Legal Counsel on PHI/HIPAA:** Given the handling of sensitive health data (PHI), the project should seek advice from legal counsel specializing in digital health to fully understand regulatory risks and obligations (such as HIPAA in the US).
- **[TODO] Improve AI Pipeline Resilience:** The background worker's multi-pass AI and TTS pipeline should be made more resilient. This includes implementing robust error-handling, state management, and a retry mechanism to handle transient failures in external API calls.