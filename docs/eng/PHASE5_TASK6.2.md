# Goodnumbers — `todo.md` (V4 - Unabridged TDD Edition)

## TL;DR

Implement the journal loading page with asynchronous status and progress polling against a simulated backend worker, and build the data-driven, low-fidelity journal view page. All complex data components (charts, selectors) will be replaced with a generic **DataDisplayWidget** that simply pretty-prints the JSON data, enabling faster iteration on the core data flow.

## Invariants (do not change)

- All data fetching from the backend **must** use the centralized `axios` instance from `frontend/src/lib/api.ts`.
- The journal loading page **must** poll the `GET /api/journals/:id/status` endpoint to track job progress.
- Upon successful journal generation (`COMPLETE` status), the user **must** be redirected to the corresponding `/journal/:id` view page.
- The journal view page **must** fetch its data from the `GET /api/journals/:id` endpoint and be rendered as a read-only view.
- All new routes must be placed under the `ProtectedRoute` to ensure only authenticated and onboarded users can access them.

## Assumptions & Scope

- **Assumption:** All preceding Phase 5 tasks are complete. The monorepo is configured, and the frontend project is initialized with a working dashboard.
- **Assumption:** The backend development server is running and all required API endpoints (`/journals`, `/journals/:id/status`, `/journals/:id`) are functional and enforce ownership.
- **Assumption:** A suitable charting library is needed; `recharts` will be used.
- **Scope:**
  - **Backend:** Temporarily modify the background worker to simulate a multi-stage generation process with realistic delays.
  - **Frontend:** Implement the client-side logic for the `JournalLoadingPage` to poll for status, progress, and status messages.
  - **Frontend:** Create a new route (`/journal/:id`) and a new "smart" container page, `JournalPage`, to display a completed journal.
  - **Frontend:** Build a generic `DataDisplayWidget` and use it to render the data payloads for all complex components (AGP Chart, Clusters, Vibe, Factors, Goals).
- **Out of Scope:** Implementation of the "Save and Close" action bar functionality and any `PUT` requests to update journal data. This task is strictly for the **read-only** view and explicitly defers the high-fidelity UI implementation for all components except the Podcast Player.

## Objectives

1.  **Simulate Backend Processing:** Temporarily modify the backend worker to provide a realistic, multi-stage progress simulation for frontend development.
2.  **Implement Status Polling:** Create a robust polling mechanism on the `JournalLoadingPage` that displays the `progress` and `statusMessage` to the user.
3.  **Complete the Loading Flow:** Ensure the user is correctly redirected from the loading page to the final journal view page upon successful completion, or shown a clear error state on failure.
4.  **Fetch and Display Journal Data:** Successfully fetch the complete data for a single journal and pass it down to the appropriate UI components.
5.  **Build Core UI Components (Low Fidelity):** Implement the functional `PodcastPlayer` and a new generic `DataDisplayWidget` to display all other data payloads (AGP, Clusters, Insights, Vibe, Factors, Goals).
6.  **Guarantee Correctness with Tests:** Ensure all new hooks, components, and pages are covered by a comprehensive suite of passing tests.

## Risks & Mitigations

- **Risk:** The status polling logic could result in an infinite loop or excessive network requests.
  - **Mitigation:** The polling mechanism will be encapsulated in a custom hook (`useJournalStatus`) that includes a hard stop condition (on `COMPLETE` or `FAILED`), a fixed interval, and a maximum timeout to prevent run-away requests.

- **Risk:** The provided raw mock data is in a different format than the final API response.
  - **Mitigation:** The plan includes a dedicated step to transform the raw data into a clean, API-compliant mock object that will be the single source of truth for all frontend component development and testing.

## Method Outline (idea → mechanism → trade-offs → go/no-go)

- **Idea:** Decompose the feature into a backend simulation task, a "smart" hook for polling logic, a "smart" container for the loading page, and a "smart" container for the view page which orchestrates multiple "dumb" presentational components.
- **Mechanism:**
  1.  **Backend First:** Implement the temporary, simulated journal processing logic in the backend worker.
  2.  **Frontend Setup:** Install new dependencies and create the clean, API-compliant mock data file from the raw JSON provided.
  3.  **Polling Logic:** Create a custom React hook, `useJournalStatus`, to encapsulate all polling logic.
  4.  **Loading Page:** Refactor the `JournalLoadingPage` to use the `useJournalStatus` hook.
  5.  **View Page Routing & Container:** Add the `/journal/:id` route and create the `JournalPage.tsx` container to fetch data.
  6.  **Componentization:** Build all UI components as "dumb" presentational components that receive data via props, tested against the clean mock data.
- **Go/No-Go Decision:** **Go**.

## Implementation Notes

- **A Note on JSON Formats:** The JSON structures for `agpChartData` and `clusterDataJson` (found in `frontend/src/mocks/journal.ts`) are to be treated as **temporary, non-binding placeholders** for this task. Their only purpose is to validate that a valid JSON object can be passed from the container to the display widget. The final, binding contract for these data structures will be defined in future, dedicated design documents when the high-fidelity UI components for each chart are built.
- **API Endpoints:** `GET /api/journals/:id/status`, `GET /api/journals/:id`.
- **New Route:** `/journal/:id`.

- **Design Decision: Audio Format:**
  - **Recommendation:** Use **MP3** for the podcast audio.
  - **Rationale:** MP3 offers excellent compression, resulting in significantly smaller file sizes compared to WAV. This is critical for web performance, as it reduces user bandwidth consumption and decreases page load times. It has universal support across all modern browsers.
  * **Action:** The provided mock audio file should be an MP3. It will be placed in the `frontend/public/audio/` directory to be served statically.

### API Contract: `GET /api/journals/:id`

The `JournalPage` will expect a JSON response from this endpoint with the following structure. All types (`Journal`, `GlycemicEventCluster`) are imported from `@goodnumbers/types`.

```typescript
// Expected JSON Response Shape
interface JournalResponse extends Journal {
  clusters: GlycemicEventCluster[];
}
```

## Acceptance Gates

1.  Clicking "Start Journal" on the dashboard triggers the simulated backend process.
2.  The loading page displays a progress bar and status messages that update every ~5 seconds.
3.  When the simulated process is `COMPLETE`, the user is automatically redirected to `/journal/:id`.
4.  Navigating to `/journal/:id` fetches and correctly displays all sections of the journal report using the provided mock data.
5.  The mock podcast MP3 plays correctly from the `PodcastPlayer` component.
6.  `npm test -w frontend` and `npm test -w backend` pass with 100% success.

## “Make-sure-you” Checklist

- [ ] Have you implemented the temporary simulated worker logic in `backend/src/worker.ts`?

- [ ] Have you created the `frontend/public/audio` directory and placed the mock MP3 file there?
- [ ] Have you created the clean `frontend/src/mocks/journal.ts` file by transforming the raw JSON?
- [ ] Does your `useJournalStatus` hook have a clear stopping condition?

## Project hygiene prep

1.  **Create Issue:**
    ```bash
    gh issue create --title "feat(ui): P5_T6.2 Implement Journal Loading and View Pages" --body "Build the status polling logic for the journal loading page and the full read-only UI for the journal view page, as per the PRD. Closes #XX"
    ```
2.  **Create Branch:**
    ```bash
    git checkout phase5develop
    git pull origin phase5develop
    git checkout -b feat/phase5-task6.2-journal-view
    ```
3.  **Adopt Test-Driven Development:** For each new piece of logic and each new component, create the `.test.tsx` file first. Write a failing test that defines the desired behavior, then write the code to make it pass.

---

## In-depth engineering plan

### Part 0: Backend Prerequisite - Simulate the Worker

**Objective:** Modify the backend worker to simulate a realistic, multi-stage generation process. This is a temporary change for development purposes.

1.  **Modify `backend/src/worker.ts`:** Replace the content of the `processJournalJob` function with the simulation logic below.

    ```typescript
    // file: backend/src/worker.ts
    import { Job } from "bullmq";
    import { prisma } from "./lib/prisma.js";

    // Helper function for async delays
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    export async function processJournalJob(job: Job) {
      const { journalId } = job.data;
      console.log(
        `[Worker] FAKE Processing job ${job.id} (Journal ID: ${journalId})`
      );

      try {
        // Stage 1: Fetching Data
        await prisma.journal.update({
          where: { id: journalId },
          data: {
            status: "ANALYZING_DATA",
            progress: 20,
            statusMessage:
              "Gathering your blood glucose, insulin, and meal data...",
          },
        });
        await sleep(5000); // 5-second delay

        // Stage 2: Statistical Analysis
        await prisma.journal.update({
          where: { id: journalId },
          data: {
            status: "DRAFTING_INSIGHTS",
            progress: 40,
            statusMessage: "Running analysis to find trends and hotspots...",
          },
        });
        await sleep(5000);

        // Stage 3: AI Scripting
        await prisma.journal.update({
          where: { id: journalId },
          data: {
            status: "GENERATING_AUDIO",
            progress: 60,
            statusMessage:
              "Writing the script for your personalized audio summary...",
          },
        });
        await sleep(5000);

        // Stage 4: Audio Generation
        await prisma.journal.update({
          where: { id: journalId },
          data: { progress: 80, statusMessage: "Recording your podcast..." },
        });
        await sleep(5000);

        // Final Stage: Complete
        await prisma.journal.update({
          where: { id: journalId },
          data: {
            status: "COMPLETE",
            progress: 100,
            statusMessage: "Your journal is ready.",
          },
        });

        console.log(`[Worker] FAKE Finished job ${job.id}`);
        return { status: "done" };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[Worker] Job ${job.id} failed for journal ${journalId}:`,
          errorMessage
        );

        await prisma.journal.update({
          where: { id: journalId },
          data: {
            status: "FAILED",
            statusMessage: `Simulation failed: ${errorMessage}`,
          },
        });
        throw error;
      }
    }
    ```

2.  **Restart Backend:** Make sure to restart your backend development server (`npm run dev:backend`) for these changes to take effect.

### Part 1: Frontend Setup

1.  **Install Dependencies:** No new dependencies are required for this task.
2.  **Create Asset Directory & Mock Audio:**

    ```bash
    mkdir -p frontend/public/audio
    ```

    Place the provided `mock-podcast.mp3` file into this new `frontend/public/audio/` directory.

3.  **Define Shared API Types:** Create a new file to house API-specific types that are not full Prisma models. Then, export this new type from the package's entry point.

    ```bash
    touch packages/types/src/api-types.ts
    ```

    ```typescript
    // file: packages/types/src/api-types.ts
    export interface JournalStatus {
      status: string;
      progress: number;
      statusMessage: string | null;
    }
    ```

    Now, export it from the main `index.ts` file for the types package.

    ```diff
    --- a/packages/types/src/index.ts
    +++ b/packages/types/src/index.ts
    @@ -8,3 +8,4 @@
       Session,
       VerificationToken,
     } from "./generated/client";
    ```

- export type { JournalStatus } from "./api-types";

  ```

  ```

4.  **Create Raw Mock Data File:**

    ```bash
    touch frontend/src/mocks/raw_journal_data.json
    ```

    Copy and paste the entire `mock_assessment_abridged.json` content into this new file.

5.  **Create Clean, API-Compliant Mock Data File:**

    ```bash
    touch frontend/src/mocks/journal.ts
    ```

    Populate `frontend/src/mocks/journal.ts` with the following code. This transforms the raw data into the format our application expects.

    ```typescript
    // file: frontend/src/mocks/journal.ts
    import {
      type Journal,
      type GlycemicEventCluster,
    } from "@goodnumbers/types";
    import rawData from "./raw_journal_data.json";

    export const mockJournalForView: Journal & {
      clusters: GlycemicEventCluster[];
    } = {
      id: rawData.assessmentData.id,
      createdAt: new Date(rawData.timestamp),
      updatedAt: new Date(rawData.timestamp),
      userId: "mock-user-id",
      podcastTitle: rawData.assessmentData.podcastResult.title,
      podcastDescription: rawData.assessmentData.podcastResult.description,
      podcastAudioUrl: "/audio/mock-podcast.mp3",
      agpChartData: rawData.reportItems[0].data,
      analysisInsights: rawData.reportItems[0].insights,
      weeklyVibe: null,
      influencingFactors: [],
      goalsForNextWeek: null,
      clusters: [
        {
          id: "cluster-1",
          journalId: rawData.assessmentData.id,
          eventType: "HIGH",
          eventCount: 4,
          meanTimeMinutes: 404,
          clusterDataJson: rawData.reportItems[1].data[0],
          userNotes: null,
        },
        {
          id: "cluster-2",
          journalId: rawData.assessmentData.id,
          eventType: "VERY_HIGH",
          eventCount: 5,
          meanTimeMinutes: 1230,
          clusterDataJson: rawData.reportItems[2].data[0],
          userNotes: null,
        },
        {
          id: "cluster-3",
          journalId: rawData.assessmentData.id,
          eventType: "SEVERE_HYPOGLYCEMIA",
          eventCount: 4,
          meanTimeMinutes: 815,
          clusterDataJson: rawData.reportItems[3].data[0],
          userNotes: null,
        },
      ],
      status: "COMPLETE",
      progress: 100,
      statusMessage: "Your journal is ready.",
    };
    ```

6.  **Add New Route:** Open `frontend/src/App.tsx` and add the route for the journal view page inside the `ProtectedRoute`.
    ```diff
    --- a/frontend/src/App.tsx
    +++ b/frontend/src/App.tsx
    @@ -50,6 +50,10 @@
             path: 'journal/:journalId/loading',
             element: <JournalLoadingPage />,
           },
    +      {
    +        path: 'journal/:id',
    +        element: <JournalPage />,
    +      },
           // Add other protected routes here
         ],
       },
    ```

### Part 2: Implement Status Polling (TDD)

1.  **(RED) Create the Hook Test:**

    ```bash
    touch frontend/src/hooks/useJournalStatus.test.ts
    ```

    Populate it with this test code, which will fail because the hook doesn't exist.

    ```typescript
    // file: frontend/src/hooks/useJournalStatus.test.ts
    import { renderHook, waitFor, act } from "@testing-library/react";
    import { describe, it, expect, vi, afterEach } from "vitest";
    import { api } from "../lib/api";
    import { useJournalStatus } from "./useJournalStatus";

    vi.mock("../lib/api");
    vi.useFakeTimers();

    describe("useJournalStatus", () => {
      afterEach(() => {
        vi.clearAllMocks();
      });

      it("should start with a PENDING status and poll the API", async () => {
        const mockApiGet = vi.mocked(api.get).mockResolvedValue({
          data: {
            status: "ANALYZING_DATA",
            progress: 20,
            statusMessage: "Analyzing...",
          },
        });

        const { result } = renderHook(() => useJournalStatus("test-id"));

        expect(result.current.status).toBe("PENDING");
        expect(result.current.progress).toBe(0);

        await act(async () => {
          vi.advanceTimersByTime(2100); // Advance time past the 2s interval
        });

        await waitFor(() => {
          expect(mockApiGet).toHaveBeenCalledWith("/journals/test-id/status");
          expect(result.current.status).toBe("ANALYZING_DATA");
          expect(result.current.progress).toBe(20);
        });
      });

      it("should stop polling when status is COMPLETE", async () => {
        vi.mocked(api.get).mockResolvedValue({
          data: { status: "COMPLETE", progress: 100, statusMessage: "Done" },
        });

        const { result } = renderHook(() => useJournalStatus("test-id"));

        await act(async () => {
          vi.advanceTimersByTime(2100);
        });

        await waitFor(() => expect(result.current.status).toBe("COMPLETE"));

        // Clear mocks and advance time again to ensure no more calls are made
        vi.mocked(api.get).mockClear();
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });
        expect(api.get).not.toHaveBeenCalled();
      });
    });
    ```

2.  **(GREEN) Create the Hook:**

    ```bash
    touch frontend/src/hooks/useJournalStatus.ts
    ```

    Implement the hook to make the tests pass.

    ```typescript
    // file: frontend/src/hooks/useJournalStatus.ts
    import { useState, useEffect } from "react";
    import { api } from "../lib/api";
    import type { JournalStatus } from "@goodnumbers/types";

    export function useJournalStatus(journalId: string | undefined) {
      const [status, setStatus] = useState<JournalStatus>({
        status: "PENDING",
        progress: 0,
        statusMessage: "Initializing...",
      });
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        if (
          !journalId ||
          status.status === "COMPLETE" ||
          status.status === "FAILED"
        ) {
          return;
        }

        const poll = async () => {
          try {
            const response = await api.get<JournalStatus>(
              `/journals/${journalId}/status`
            );
            setStatus(response.data);
          } catch (err) {
            setError("Failed to fetch journal status.");
            setStatus((prev) => ({ ...prev, status: "FAILED" }));
          }
        };

        const intervalId = setInterval(poll, 2000);

        return () => clearInterval(intervalId);
      }, [journalId, status.status]);

      return { ...status, error };
    }
    ```

3.  **(RED) Update the Loading Page Test:** Modify `frontend/src/pages/JournalLoadingPage.test.tsx` to mock the new hook. This test will now verify that the page correctly consumes the hook's state and navigates on completion. Note that the progress bar requires a `role` attribute to be testable.

    ```typescript
    // file: frontend/src/pages/JournalLoadingPage.test.tsx
    import { render, screen, waitFor } from '@testing-library/react';
    import { describe, it, expect, vi } from 'vitest';
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
    import JournalLoadingPage from './JournalLoadingPage';
    import * as useJournalStatusModule from '../hooks/useJournalStatus';

    // Mock the hook
    vi.mock('../hooks/useJournalStatus');
    const mockedUseJournalStatus = vi.mocked(useJournalStatusModule.useJournalStatus);

    // Mock navigate
    const mockNavigate = vi.fn();
    vi.mock('react-router-dom', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    describe('JournalLoadingPage', () => {
      it('displays the progress and status message from the hook', () => {
        mockedUseJournalStatus.mockReturnValue({
          status: 'ANALYZING_DATA',
          progress: 50,
          statusMessage: 'Analyzing your data...',
          error: null,
        });

        render(
          <MemoryRouter>
            <JournalLoadingPage />
          </MemoryRouter>
        );

        expect(screen.getByText('Generating Your Journal...')).toBeInTheDocument();
        expect(screen.getByText('Analyzing your data...')).toBeInTheDocument();
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveStyle({ width: '50%' });
      });

      it('navigates to the journal page when status is COMPLETE', async () => {
        mockedUseJournalStatus.mockReturnValue({
          status: 'COMPLETE',
          progress: 100,
          statusMessage: 'Your journal is ready.',
          error: null,
        });

        render(
          <MemoryRouter initialEntries={['/journal/test-id/loading']}>
            <Routes>
              <Route path="/journal/:journalId/loading" element={<JournalLoadingPage />} />
            </Routes>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith('/journal/test-id', { replace: true });
        });
      });

      it('displays an error message when the hook reports an error', () => {
        mockedUseJournalStatus.mockReturnValue({
          status: 'FAILED',
          progress: 0,
          statusMessage: 'Something went wrong.',
          error: 'API connection failed',
        });

        render(
          <MemoryRouter>
            <JournalLoadingPage />
          </MemoryRouter>
        );

        expect(screen.getByText('Generation Failed')).toBeInTheDocument();
        expect(screen.getByText('API connection failed')).toBeInTheDocument();
      });
    });
    ```

4.  **(GREEN) Refactor the Loading Page:** Update `frontend/src/pages/JournalLoadingPage.tsx` to use the hook and display progress.

    ```typescript
    // file: frontend/src/pages/JournalLoadingPage.tsx
    import { useEffect } from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { useJournalStatus } from '../hooks/useJournalStatus';
    import { Loader2, AlertTriangle } from 'lucide-react';

    export default function JournalLoadingPage() {
      const { journalId } = useParams<{ journalId: string }>();
      const navigate = useNavigate();
      const { status, progress, statusMessage, error } = useJournalStatus(journalId);

      useEffect(() => {
        if (status === 'COMPLETE') {
          navigate(`/journal/${journalId}`, { replace: true });
        }
      }, [status, journalId, navigate]);

      const isFailed = status === 'FAILED';

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white p-8 rounded-xl shadow-lg m-4">
          {isFailed ? (
            <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
          ) : (
            <Loader2 className="animate-spin w-16 h-16 text-[#1976d2] mb-6" />
          )}
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            {isFailed ? 'Generation Failed' : 'Generating Your Journal...'}
          </h1>
          <p className={`text-gray-600 text-lg text-center max-w-md ${isFailed ? 'text-red-600' : ''}`}>
            {error || statusMessage || 'Please wait a moment.'}
          </p>

          {!isFailed && (
            <div className="w-full max-w-md mt-6">
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin="0"
                aria-valuemax="100"
                className="w-full bg-gray-200 rounded-full h-2.5"
              >
                <div
                  className="bg-[#1976d2] h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      );
    }
    ```

### Part 3: Implement Journal View Page Container (TDD)

**Objective:** To create the "smart" container component that fetches the complete journal data and orchestrates the rendering of all the "dumb" presentational components.

1.  **(RED) Create the View Page Test:** This test will verify the data fetching, loading, and error states of our main container page. It will use mocks for the child components to keep the test focused on the container's logic.

    ```bash
    touch frontend/src/pages/JournalPage.test.tsx
    ```

    Populate it with the following test code. It will fail because the page and its child components do not exist yet.

    ```typescript
    // file: frontend/src/pages/JournalPage.test.tsx
    import { render, screen, waitFor } from '@testing-library/react';
    import { describe, it, expect, vi } from 'vitest';
    import { MemoryRouter, Route, Routes } from 'react-router-dom';
    import JournalPage from './JournalPage';
    import { api } from '../lib/api';
    import { mockJournalForView } from '../mocks/journal';

    // Mock the API and all child components
    vi.mock('../lib/api');
    vi.mock('../components/journal/PodcastPlayer', () => ({ default: () => <div data-testid="podcast-player" /> }));
    vi.mock('../components/journal/AGPChart', () => ({ default: () => <div data-testid="agp-chart" /> }));
    vi.mock('../components/journal/InsightsList', () => ({ default: () => <div data-testid="insights-list" /> }));
    vi.mock('../components/journal/WeeklyVibe', () => ({ default: () => <div data-testid="weekly-vibe" /> }));
    vi.mock('../components/journal/InfluencingFactors', () => ({ default: () => <div data-testid="influencing-factors" /> }));
    vi.mock('../components/journal/EventClusterCard', () => ({ default: ({ cluster }) => <div data-testid={`cluster-card-${cluster.id}`} /> }));
    vi.mock('../components/journal/Goals', () => ({ default: () => <div data-testid="goals" /> }));

    const renderComponent = (journalId: string) => {
      render(
        <MemoryRouter initialEntries={[`/journal/${journalId}`]}>
          <Routes>
            <Route path="/journal/:id" element={<JournalPage />} />
          </Routes>
        </MemoryRouter>
      );
    };

    describe('JournalPage', () => {
      it('shows a loading state while fetching data', () => {
        vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
        renderComponent('test-id');
        expect(screen.getByText(/Loading your journal.../i)).toBeInTheDocument();
      });

      it('shows an error message if the API call fails', async () => {
        vi.mocked(api.get).mockRejectedValue(new Error('Failed to fetch'));
        renderComponent('test-id');
        await waitFor(() => {
          expect(screen.getByText(/Failed to load journal/i)).toBeInTheDocument();
        });
      });

      it('fetches data and renders all child components on success', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: mockJournalForView });
        renderComponent(mockJournalForView.id);

        await waitFor(() => {
          expect(api.get).toHaveBeenCalledWith(`/journals/${mockJournalForView.id}`);
          // Verify all components are rendered
          expect(screen.getByTestId('podcast-player')).toBeInTheDocument();
          expect(screen.getByTestId('weekly-vibe')).toBeInTheDocument();
          expect(screen.getByTestId('influencing-factors')).toBeInTheDocument();
          expect(screen.getByTestId('cluster-card-cluster-1')).toBeInTheDocument(); // Check for cluster cards
          expect(screen.getByTestId('agp-chart')).toBeInTheDocument();
          expect(screen.getByTestId('insights-list')).toBeInTheDocument();

          expect(screen.getByTestId('goals')).toBeInTheDocument();
        });
      });
    });
    ```

2.  **(GREEN) Create the View Page Container:**

    ```bash
    touch frontend/src/pages/JournalPage.tsx
    ```

    Implement the page to fetch data and render its children, making the tests pass.

    ```typescript
    // file: frontend/src/pages/JournalPage.tsx
    import { useState, useEffect } from 'react';
    import { useParams } from 'react-router-dom';
    import { api } from '../lib/api';
    import { type Journal, type GlycemicEventCluster } from '@goodnumbers/types';
    import { Loader2, AlertTriangle } from 'lucide-react';

    // Import placeholder components for now. We will create these next.
    const PodcastPlayer = () => <div data-testid="podcast-player">Podcast Player Placeholder</div>;
    const AGPChart = () => <div data-testid="agp-chart">AGP Chart Placeholder</div>;
    const InsightsList = () => <div data-testid="insights-list">Insights List Placeholder</div>;
    const WeeklyVibe = () => <div data-testid="weekly-vibe">Weekly Vibe Placeholder</div>;
    const InfluencingFactors = () => <div data-testid="influencing-factors">Influencing Factors Placeholder</div>;
    const EventClusterCard = ({ cluster }) => <div data-testid={`cluster-card-${cluster.id}`}>Event Cluster Placeholder</div>;
    const Goals = () => <div data-testid="goals">Goals Placeholder</div>;

    type JournalResponse = Journal & { clusters: GlycemicEventCluster[] };

    export default function JournalPage() {
      const { id } = useParams<{ id: string }>();
      const [journal, setJournal] = useState<JournalResponse | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        if (!id) return;
        const fetchJournal = async () => {
          setIsLoading(true);
          try {
            const response = await api.get<JournalResponse>(`/journals/${id}`);
            setJournal(response.data);
          } catch (err) {
            setError('Failed to load journal. It might not exist or you may not have permission to view it.');
          } finally {
            setIsLoading(false);
          }
        };
        void fetchJournal();
      }, [id]);

      if (isLoading) {
        return (
          <div className="flex items-center justify-center min-h-[80vh] p-8">
            <Loader2 className="animate-spin w-8 h-8 text-[#1976d2]" />
            <span className="ml-3 text-lg text-gray-700">Loading your journal...</span>
          </div>
        );
      }

      if (error) {
        return (
          <div className="max-w-4xl mx-auto p-8 text-red-600 bg-red-100 rounded-xl m-4 text-center font-semibold flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 mr-3" /> {error}
          </div>
        );
      }

      if (!journal) {
        return null; // Or a "Not Found" component
      }

      return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
          {/* We will replace these with the real components in Part 4 and 5 */}
          <PodcastPlayer />
          <AGPChart />
          <InsightsList />
          <WeeklyVibe />
          <InfluencingFactors />
          {journal.clusters.map(cluster => (
            <EventClusterCard key={cluster.id} cluster={cluster} />
          ))}
          <Goals />
        </div>
      );
    }
    ```

### Part 4: Build All Presentational Components (Iterative TDD)

**Objective:** To implement the functional `PodcastPlayer` and a generic `DataDisplayWidget` that will be used as a low-fidelity stand-in for all complex UI components, allowing us to validate the data flow before implementing the high-fidelity visualizations.

#### Step 1 (RED): Test the Generic Data Display Widget

Create the test file. It will fail.

```bash
touch frontend/src/components/journal/DataDisplayWidget.test.tsx
```

```typescript
// file: frontend/src/components/journal/DataDisplayWidget.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DataDisplayWidget from './DataDisplayWidget';

describe('DataDisplayWidget', () => {
  it('renders the title and pretty-prints the JSON data', () => {
    const mockData = {
      median: 120,
      percentile_range: [70, 180],
      notes: 'This is a test note.',
    };
    render(<DataDisplayWidget title="AGP Chart Data" data={mockData} />);

    expect(screen.getByRole('heading', { name: /AGP Chart Data/i })).toBeInTheDocument();
    // Check for a few key pieces of the pretty-printed JSON
    expect(screen.getByText(/"median": 120/i)).toBeInTheDocument();
    expect(screen.getByText(/"notes": "This is a test note."/i)).toBeInTheDocument();
  });

  it('renders a null state message if data is null', () => {
    render(<DataDisplayWidget title="Cluster Data" data={null} />);
    expect(screen.getByText(/No data available for Cluster Data/i)).toBeInTheDocument();
  });
});
```

#### Step 2 (GREEN): Implement the Generic Data Display Widget

Create the component to make the test pass. This component uses `JSON.stringify` to display the raw data payload in a readable format.

```bash
touch frontend/src/components/journal/DataDisplayWidget.tsx
```

```typescript
// file: frontend/src/components/journal/DataDisplayWidget.tsx
import { Json } from '@goodnumbers/types';

interface DataDisplayWidgetProps {
  title: string;
  data: Json | null;
}

export default function DataDisplayWidget({ title, data }: DataDisplayWidgetProps) {
  if (!data) {
    return (
      <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-500">No data available for {title}.</p>
      </section>
    );
  }

  // Use JSON.stringify for pretty-printing
  const prettyPrintedData = JSON.stringify(data, null, 2);

  return (
    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title} (Low-Fidelity Data View)</h2>
      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 border border-gray-200">
        {prettyPrintedData}
      </pre>
    </section>
  );
}
```

#### Step 3: Implement the Functional Podcast Player

We will now implement the functional `PodcastPlayer` (Component 1 from the original plan), as it is the only high-fidelity component required for this simplified scope.

1.  **(RED) Create the Test:**

    ```bash
    touch frontend/src/components/journal/PodcastPlayer.test.tsx
    ```

    ```typescript
    // file: frontend/src/components/journal/PodcastPlayer.test.tsx
    import { render, screen, fireEvent } from '@testing-library/react';
    import { describe, it, expect, vi } from 'vitest';
    import PodcastPlayer from './PodcastPlayer';
    import { mockJournalForView } from '../../mocks/journal';

    describe('PodcastPlayer', () => {
      it('renders the title, description, and a lazy-load button', () => {
        render(
          <PodcastPlayer
            title={mockJournalForView.podcastTitle}
            description={mockJournalForView.podcastDescription}
            audioUrl={mockJournalForView.podcastAudioUrl}
          />
        );
        expect(screen.getByRole('heading', { name: mockJournalForView.podcastTitle })).toBeInTheDocument();
        expect(screen.getByText(mockJournalForView.podcastDescription!)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Click to load AI discussion/i })).toBeInTheDocument();
      });

      it('loads and displays the audio player when the button is clicked', () => {
        render(
          <PodcastPlayer
            title={mockJournalForView.podcastTitle}
            description={mockJournalForView.podcastDescription}
            audioUrl={mockJournalForView.podcastAudioUrl}
          />
        );
        const loadButton = screen.getByRole('button', { name: /Click to load AI discussion/i });
        fireEvent.click(loadButton);

        expect(screen.queryByRole('button', { name: /Click to load AI discussion/i })).not.toBeInTheDocument();
        const audioPlayer = screen.getByTestId('audio-player');
        expect(audioPlayer).toBeInTheDocument();
        expect(audioPlayer).toHaveAttribute('src', mockJournalForView.podcastAudioUrl);
      });
    });
    ```

2.  **(GREEN) Create the Component:**

    ```bash
    touch frontend/src/components/journal/PodcastPlayer.tsx
    ```

    ```typescript
    // file: frontend/src/components/journal/PodcastPlayer.tsx
    import { useState } from 'react';
    import { PlayCircle } from 'lucide-react';

    interface PodcastPlayerProps {
      title: string | null;
      description: string | null;
      audioUrl: string | null;
    }

    export default function PodcastPlayer({ title, description, audioUrl }: PodcastPlayerProps) {
      const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);

      if (!audioUrl) {
        return (
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center text-gray-500">
            No podcast audio available for this journal.
          </div>
        );
      }

      return (
        <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{title || 'Weekly Summary'}</h2>
          <p className="text-gray-600 mb-6">{description || 'Listen to your personalized summary.'}</p>

          {isPlayerLoaded ? (
            <audio controls src={audioUrl} className="w-full" data-testid="audio-player">
              Your browser does not support the audio element.
            </audio>
          ) : (
            <button
              onClick={() => setIsPlayerLoaded(true)}
              className="w-full p-4 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <PlayCircle className="w-6 h-6 mr-3" />
              Click to load AI discussion on your numbers
            </button>
          )}
        </section>
      );
    }
    ```

#### Step 4: Implement Low-Fidelity Wrappers (Detailed)

**Objective:** Create a simple 'wrapper' component for each data section of the journal. Each wrapper will receive its specific data as a prop from the `JournalPage` container and pass it to our generic `DataDisplayWidget` for rendering. This allows us to verify that the main `JournalPage` is correctly passing data down to all its children before we build the final, high-fidelity UI for each one.

##### Wrapper 1: AGPChart

Create the file `frontend/src/components/journal/AGPChart.tsx` with the following content.

```typescript
// file: frontend/src/components/journal/AGPChart.tsx
import DataDisplayWidget from './DataDisplayWidget';
import { Json } from '@goodnumbers/types';

export default function AGPChart({ data }: { data: Json | null }) {
  return <DataDisplayWidget title="Ambulatory Glucose Profile (AGP) Chart Data" data={data} />;
}
```

**Explanation:** This component receives the `agpChartData` object from the main page and passes it to our generic widget. The `title` prop is customized to clearly label the output for this specific section.

##### Wrapper 2: InsightsList

Create the file `frontend/src/components/journal/InsightsList.tsx` with the following content.

```typescript
// file: frontend/src/components/journal/InsightsList.tsx
import DataDisplayWidget from './DataDisplayWidget';
import { Json } from '@goodnumbers/types';

export default function InsightsList({ data }: { data: Json | null }) {
  return <DataDisplayWidget title="Key Insights Data" data={data} />;
}
```

**Explanation:** This component receives the `analysisInsights` array from the main page and renders it using the generic widget.

##### Wrapper 3: WeeklyVibe

Create the file `frontend/src/components/journal/WeeklyVibe.tsx` with the following content.

```typescript
// file: frontend/src/components/journal/WeeklyVibe.tsx
import DataDisplayWidget from './DataDisplayWidget';

export default function WeeklyVibe({ data }: { data: string | null }) {
  return <DataDisplayWidget title="Weekly Vibe Data" data={data} />;
}
```

**Explanation:** This component receives the `weeklyVibe` string from the main page.

##### Wrapper 4: InfluencingFactors

Create the file `frontend/src/components/journal/InfluencingFactors.tsx` with the following content.

```typescript
// file: frontend/src/components/journal/InfluencingFactors.tsx
import DataDisplayWidget from './DataDisplayWidget';
import { Json } from '@goodnumbers/types';

export default function InfluencingFactors({ data }: { data: Json | null }) {
  return <DataDisplayWidget title="Influencing Factors Data" data={data} />;
}
```

**Explanation:** This component receives the `influencingFactors` array from the main page.

##### Wrapper 5: EventClusterCard

Create the file `frontend/src/components/journal/EventClusterCard.tsx` with the following content. Note that this component's props are slightly different, as it receives the entire `cluster` object.

```typescript
// file: frontend/src/components/journal/EventClusterCard.tsx
import DataDisplayWidget from './DataDisplayWidget';
import type { GlycemicEventCluster } from '@goodnumbers/types';

export default function EventClusterCard({ cluster }: { cluster: GlycemicEventCluster }) {
  // We create a dynamic title to make the output clearer
  const title = `Glycemic Event Cluster: ${cluster.eventType} (x${cluster.eventCount})`;
  // We pass the entire cluster object to see all its data, including the summary fields.
  return <DataDisplayWidget title={title} data={cluster} />;
}
```

**Explanation:** This component is used inside a loop on the main page. It receives a single `cluster` object as a prop. We create a dynamic title to identify the cluster and pass the entire object to the widget to display all its contents, including the summary data and the detailed visualization data.

##### Wrapper 6: Goals

Create the file `frontend/src/components/journal/Goals.tsx` with the following content.

```typescript
// file: frontend/src/components/journal/Goals.tsx
import DataDisplayWidget from './DataDisplayWidget';

export default function Goals({ data }: { data: string | null }) {
  return <DataDisplayWidget title="Goals for Next Week Data" data={data} />;
}
```

**Explanation:** This component receives the `goalsForNextWeek` string from the main page.

### Part 5: Assemble and Finalize

1.  **Integrate Real Components:** Open `JournalPage.tsx`. Import the real components and replace the placeholders. Note that the component imports in the test file (`JournalPage.test.tsx`) are now redundant as they are already mocked, but we must update the imports in the actual component file.

    ```diff
    --- a/frontend/src/pages/JournalPage.tsx
    +++ b/frontend/src/pages/JournalPage.tsx
    @@ -6,12 +6,12 @@
     import { Loader2, AlertTriangle } from 'lucide-react';

     // Import placeholder components for now. We will create these next.
     const PodcastPlayer = () => <div data-testid="podcast-player">Podcast Player Placeholder</div>;
    ```

- const AGPChart = () => <div data-testid="agp-chart">AGP Chart Placeholder</div>;
- const InsightsList = () => <div data-testid="insights-list">Insights List Placeholder</div>;
- const WeeklyVibe = () => <div data-testid="weekly-vibe">Weekly Vibe Placeholder</div>;
- const InfluencingFactors = () => <div data-testid="influencing-factors">Influencing Factors Placeholder</div>;
- const EventClusterCard = ({ cluster }) => <div data-testid={`cluster-card-${cluster.id}`}>Event Cluster Placeholder</div>;
- const Goals = () => <div data-testid="goals">Goals Placeholder</div>;

* import PodcastPlayer from '../components/journal/PodcastPlayer';
* import AGPChart from '../components/journal/AGPChart';
* import InsightsList from '../components/journal/InsightsList';
* import WeeklyVibe from '../components/journal/WeeklyVibe';
* import InfluencingFactors from '../components/journal/InfluencingFactors';
* import EventClusterCard from '../components/journal/EventClusterCard';
* import Goals from '../components/journal/Goals';

  type JournalResponse = Journal & { clusters: GlycemicEventCluster[] };

  @@ -58,14 +58,14 @@

       return (
         <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
           {/* We will replace these with the real components in Part 4 and 5 */}

-          <PodcastPlayer />
-          <AGPChart />
-          <InsightsList />
-          <WeeklyVibe />
-          <InfluencingFactors />

*          <PodcastPlayer title={journal.podcastTitle} description={journal.podcastDescription} audioUrl={journal.podcastAudioUrl} />
*          <WeeklyVibe data={journal.weeklyVibe} />
*          <InfluencingFactors data={journal.influencingFactors} />
           {journal.clusters.map(cluster => (
             <EventClusterCard key={cluster.id} cluster={cluster} />
           ))}

-          <Goals />

*          <AGPChart data={journal.agpChartData} />
*          <InsightsList data={journal.analysisInsights} />
*          <Goals data={journal.goalsForNextWeek} />
         </div>
       );

  }

  ```

  ```

2.  **Run All Tests:** From the project root, run `npm test -w frontend`. All tests, including the container and all the new component tests, must pass.

3.  **Manual E2E Test:** Follow the manual test steps from the Acceptance Gates to verify the entire flow from dashboard to loading page to final journal view. The application should now look and feel like a complete feature.
