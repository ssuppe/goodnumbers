# Goodnumbers Static Implementation Roadmap

## Phase 1: DX, Legacy Migration & TDD Foundation
**Goal**: Flatten the project, preserve legacy logic in `legacy/`, and establish the static-first testing environment.

- [x] **Task 1.1: The Big Bang Migration**
- [x] **Task 1.2: DX Tooling & Husky Setup**
- [x] **Task 1.3: Virtual File System Mock for TDD** (Deprecated: Replaced by IndexedDB focus)

## Phase 2: The Storage & Sync Bridge (Milestone 2)
**Goal**: Implement local IndexedDB storage and GitHub sync capabilities.

- [ ] **Task 2.1: IndexedDB Repository**
    - [ ] Part A: Write tests for `idb` repository (listing, saving, deleting entries).
    - [ ] Part B: Implement `IndexedDBRepository` with `sync_status` tracking.
- [ ] **Task 2.2: GitHub Sync Engine**
    - [x] Part A: Write tests for `Octokit` sync (mocking the GitHub API).
    - [ ] Part B: Implement `GitHubSyncService` with push/pull logic.
- [ ] **Task 2.3: Storage & Sync Debug Component**
    - [ ] Part A: Build `DebugSync.tsx` to manually verify IndexedDB writes and GitHub pushes.
    - [ ] Part B: Add "Verify Credentials" and "Manual Sync" buttons.

## Phase 3: The Browser Engine (Milestone 3)
**Goal**: Migrate heavy logic to the browser and implement the Markdown storage format.

- [ ] **Task 3.1: Browser-Native Nightscout Client**
    - [ ] Part A: Write unit tests for Nightscout fetching using `fetch` mocks.
    - [ ] Part B: Migrate client from `axios` to `fetch`.
- [ ] **Task 3.2: Analysis Web Worker**
    - [ ] Part A: Write tests for `calculateAgp` and `HotspotDetector` running in a worker context.
    - [ ] Part B: Implement `analysis.worker.ts` importing legacy math logic.
- [ ] **Task 3.3: Journal Serializer (Markdown + YAML)**
    - [ ] Part A: Write tests for serializing/deserializing journal data to Markdown with YAML frontmatter.
    - [ ] Part B: Implement `JournalSerializer.ts` using `gray-matter` or similar.

## Phase 4: UI Reconstruction (Milestone 5)
**Goal**: Replace auth-based UI with the Unhosted (GitHub) workflow.

- [ ] **Task 4.1: The Setup Flow (Onboarding)**
    - [ ] Part A: Build the Setup screen for NS Credentials and GitHub settings.
    - [ ] Part B: Implement credential validation.
- [ ] **Task 4.2: Dashboard & Sync Indicators**
    - [ ] Part A: Build the Dashboard listing journals from IndexedDB.
    - [ ] Part B: Add "Syncing..." status indicators to the UI.
- [ ] **Task 4.3: The "Log Week" Loop**

## Phase 5: Cleanup & Final Validation
**Goal**: Remove debug tools and verify the production static build.

- [ ] **Task 5.1: Removal of Backend Dependencies**
- [ ] **Task 5.2: README & Documentation Update**
