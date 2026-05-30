# Goodnumbers — `phase6-task1.1-nightscout-fetch.md`

## TL;DR

Implement the backend logic to securely fetch 7 days of Nightscout data (entries, treatments, profiles) using validated URLs and HTTP headers, adhering to a strict Red-Green TDD process that includes both mocked unit tests and a live integration test against a real Nightscout instance.

## Invariants (do not change)

- **Credential Security:** Nightscout tokens must **only** be decrypted within the background worker process scope. They must never be logged or passed to the frontend.
- **SSRF Protection:** All user-provided URLs must be validated to prevent Server-Side Request Forgery (SSRF) attacks against internal infrastructure.
- **Authentication Security:** Credentials must be passed via HTTP Headers (`API-SECRET` or `Authorization`), **never** via URL query parameters, to prevent leakage in logs.
- **Data Integrity:** The fetch window must be exactly 7 days.
- **Zero Frontend Code:** This task must not require any changes to the frontend codebase. Verification relies on the existing `DataDisplayWidget`.

## Assumptions & Scope

- **Assumption:** The backend project does not yet have `axios` installed.
- **Assumption:** The `proof_of_concept` type definitions are the source of truth for Nightscout data structures.
- **Scope:** Backend only. Includes defining types, implementing a secure API client, updating the worker, and persisting raw data.
- **Out of Scope:** Data analysis, statistics calculation, high-fidelity charting, or data minimization (deferred to later tasks).

## Objectives

1.  **Define Types:** Port necessary Nightscout TypeScript interfaces to the backend.
2.  **Implement Secure Client (TDD):** Build a robust `NightscoutClient` class using Red-Green TDD, covering SSRF validation and header-based authentication.
3.  **Verify with Live Data:** Validate the client against a real Nightscout instance using a dedicated integration test.
4.  **Secure Fetching:** Update the background worker to decrypt user credentials and fetch real data.
5.  **Visual Verification:** Persist the raw fetched data to the `Journal.agpChartData` field to verify end-to-end connectivity via the frontend UI.

## Risks & Mitigations

- **Risk:** **SSRF (Server-Side Request Forgery).** A malicious user could enter `http://localhost:6379` or cloud metadata URLs to access internal systems.
  - **Mitigation:** The `NightscoutClient` will strictly validate the URL protocol (http/s) and hostname (rejecting localhost, private IPs, and reserved ranges) before making any requests.
- **Risk:** **Token Leakage in Logs.** If the API call fails, the URL might be logged.
  - **Mitigation:** We will use HTTP Headers for authentication. The `token` will not be part of the URL string, ensuring standard access logs do not record credentials.
- **Risk:** **Authentication Compatibility.** Nightscout accepts both API Secrets and JWTs.
  - **Mitigation:** The client will implement logic to detect the token type. If it is an API Secret, it will be SHA1-hashed and sent in the `API-SECRET` header. If it is a JWT (Access Token), it will be sent in the `Authorization: Bearer` header.
- **Risk:** **Timeouts.** Large datasets cause hanging processes.
  - **Mitigation:** Configure `axios` with a strict 30-second timeout.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Use a dedicated, secure API client class to encapsulate Nightscout interaction details.
- **Mechanism:**
  1.  Install `axios` in the backend.
  2.  **TDD Cycle 1 (Unit):** Write failing unit tests for `NightscoutClient` (mocked axios) covering SSRF and Auth. Implement Client to pass.
  3.  **TDD Cycle 2 (Integration):** Write a live integration test using env vars for real credentials. Verify fetching works against a real server.
  4.  **Worker Integration:** Inject this client into the `processJournalJob` function.
  5.  **Storage:** Store the result in the `agpChartData` field.
- **Trade-offs:** Storing raw data in `agpChartData` is a temporary measure for verification, but it avoids building temporary UI.
- **Go/No-Go:** **Go**. This establishes the secure communication channel required for all future analysis features.

## Implementation Notes

- **Directory:** Create `backend/src/lib/nightscout/` for the client and types.
- **Dependencies:** Run `npm install axios` in `backend`.
- **SSRF Validation Logic:**
  - Use `new URL()` parser.
  - Check protocol (`http:`/`https:`).
  - Check hostname against deny list (`localhost`, `127.0.0.1`, `::1`) and private IP regex (e.g., `^192\.168\.`, `^10\.`, `^172\.(1[6-9]|2[0-9]|3[0-1])\.`).
- **Authentication Logic:**
  - If token contains `.` (implies JWT): Use `Authorization: Bearer <token>`.
  - Else: Use `API-SECRET: <sha1(token)>`. (Requires `crypto` module).
- **Query Parameters:**
  - **Entries:** `/api/v1/entries/sgv.json?find[date][$gte]=<TIMESTAMP_MS>&count=20000`
  - **Treatments:** `/api/v1/treatments.json?find[created_at][$gte]=<TIMESTAMP_MS>&count=10000`
  - **Profiles:** `/api/v1/profile`

## Acceptance Gates

1.  `npm test -w backend` passes, including new unit tests for `NightscoutClient`.
2.  The live integration test (`nightscout-live.test.ts`) passes when provided with valid credentials.
3.  Starting a journal from the dashboard transitions the job from `PENDING` -> `COMPLETE`.
4.  The Journal View page loads and the "Ambulatory Glucose Profile (AGP) Chart" widget displays a JSON object containing `entries`, `treatments`, and `profile`.
5.  **Security Check:** Attempting to use `http://localhost:3000` as a Nightscout URL in a test case results in a specific validation error.

## “Make-sure-you” Checklist

- [ ] Did you install `axios` in the backend workspace?
- [ ] Did you implement the `validateUrl` method to block localhost and private IPs?
- [ ] Did you implement the `getAuthHeaders` method to handle both API Secrets (SHA1) and JWTs?
- [ ] Did you decrypt the token using `lib/encryption.ts` before passing it to the client?
- [ ] Did you use numeric timestamps (milliseconds) for the `$gte` query parameter?
- [ ] Did you ensure the `token` is **NOT** appended to the URL query string?
- [ ] Did you add `TEST_NIGHTSCOUT_URL` and `TEST_NIGHTSCOUT_TOKEN` to your local `.env` file for the live test? (Note: These are only for testing; real app settings are entered in the UI).

## Project hygiene prep

1.  **Branch:** `git checkout -b feat/phase6-task1.1-nightscout-fetch`
2.  **Issue:** `gh issue create --title "feat(worker): P6_T1.1 Implement Secure Nightscout Data Fetching" --body "Implement backend logic to fetch 7 days of data from Nightscout using secure headers and SSRF validation."`
3.  **Environment:** Add the real Nightscout credentials to `backend/.env` (or root `.env`) for the live test:
    ```
    TEST_NIGHTSCOUT_URL=https://your-nightscout-url.herokuapp.com
    TEST_NIGHTSCOUT_TOKEN=your-token-here
    ```

## In-depth test plan

### 1. Unit Testing (Mocked) - The "Red" Step

Create `backend/tests/unit/nightscout.test.ts`.

- **Mocking:** Use `vi.mock('axios')` to intercept HTTP requests.
- **Test Cases:**
  1.  **SSRF Protection:**
      - Input `http://localhost:1337` -> Expect Error "Invalid hostname".
      - Input `http://127.0.0.1` -> Expect Error "Invalid hostname".
      - Input `http://192.168.1.1` -> Expect Error "Invalid hostname".
      - Input `ftp://example.com` -> Expect Error "Invalid protocol".
  2.  **Authentication Headers:**
      - Input "mysecret" -> Assert header `API-SECRET: <sha1 hash>`.
      - Input "eyJh..." (JWT) -> Assert header `Authorization: Bearer eyJh...`.
  3.  **Fetch Logic:**
      - Verify correct endpoints and numeric timestamp query params.
  4.  **Error Handling:**
      - Simulate 401 Unauthorized -> Assert typed error.
      - Simulate Network Timeout -> Assert graceful failure.

### 2. Live Integration Testing - The Verification Step

Create `backend/tests/integration/nightscout-live.test.ts`.

- **Setup:** Read `TEST_NIGHTSCOUT_URL` and `TEST_NIGHTSCOUT_TOKEN` from `process.env`.
- **Condition:** If vars are missing, `console.warn` and `test.skip`.
- **Test Cases:**
  1.  **Fetch Real Data:** Instantiate `NightscoutClient` with real credentials. Call `fetchEntries(1)`. Assert that `entries` array is not empty and contains valid `sgv` data.

## In-depth engineering plan

### Step 1: Install Dependencies

1.  Navigate to project root.
2.  Run `npm install axios -w backend`.

### Step 2: Define Types

Create `backend/src/lib/nightscout/types.ts`.

- Copy relevant interfaces from `proof_of_concept/goodnumbers/types/nightscout.d.ts`:
  - `NightscoutEntry`
  - `NightscoutTreatment`
  - `NightscoutProfile` (and dependencies).

### Step 3: Create Nightscout Client (Red-Green TDD)

#### 3.1 Write Failing Unit Tests (Red)

Create `backend/tests/unit/nightscout.test.ts` with the test cases defined in the Test Plan. Run `npm test -w backend` to confirm they fail.

#### 3.2 Implement Client (Green)

Create `backend/src/lib/nightscout/client.ts`.

- **Imports:** `axios`, `crypto`.
- **Class:** `NightscoutClient`.
- **Constructor:**
  - Call `validateUrl(url)`.
  - Store `baseUrl` and `token`.
- **Method `validateUrl(url: string)`:**
  - Parse with `new URL()`.
  - Check protocol (`http:`/`https:`).
  - Check hostname against deny list (`localhost`, `127.0.0.1`, `::1`) and private IP regex.
- **Method `getAuthHeaders()`:**
  - If `token` has `.` (JWT heuristic) -> return `{ Authorization: 'Bearer ' + token }`.
  - Else -> return `{ 'API-SECRET': crypto.createHash('sha1').update(token).digest('hex') }`.
- **Fetch Methods:**
  - Use `axios.get` with `headers: this.getAuthHeaders()`.
  - Use `Date.now() - 7 * 24 * 60 * 60 * 1000` for timestamps.
  - Filter results: `data.filter(item => item.date >= timestamp)`.

Run `npm test -w backend` to confirm unit tests pass.

#### 3.3 Write & Run Live Integration Test

Create `backend/tests/integration/nightscout-live.test.ts`.

- Use the real credentials provided in `.env`.
- Run `npm test -w backend` to verify connectivity with the real Nightscout instance.

### Step 4: Update Worker Logic

Modify `backend/src/worker.ts`.

1.  Import `NightscoutClient` and `decrypt`.
2.  Inside `processJournalJob`:
    - Fetch the user (with `nightscoutUrl` and `nightscoutToken`).
    - **Decrypt** the token.
    - Instantiate `NightscoutClient` (this will throw if URL is invalid).
    - Call `fetchEntries(7)`, `fetchTreatments(7)`, `fetchProfile()` using `Promise.all`.
    - Construct a results object: `{ entries, treatments, profiles }`.
    - Update `prisma.journal`:
      - Set `status: 'COMPLETE'`.
      - Set `agpChartData: results` (casting to `any` or `Prisma.InputJsonValue` if needed).
3.  Remove the `sleep` simulation calls.

### Step 5: Verify

1.  Run `npm run dev:backend` and `npm run dev:frontend`.
2.  Log in and click "Start Journal".
3.  Observe the loading screen.
4.  Upon completion, verify the "AGP Chart" widget displays the raw JSON data.
