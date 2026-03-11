# Goodnumbers Static — Engineering Implementation Plan (Junior-Ready)

## 1. TL;DR
Transform Goodnumbers into a zero-backend, single-user PWA. Data lives in a local folder as Markdown; logic runs in browser Web Workers.

## 2. Strategic Order of Operations
We will build the new engine **inside** the existing frontend without deleting the backend yet. This allows "Side-by-Side" testing.

---

### Milestone 1: The "FileSystem" Bridge
**Goal:** Prove we can write and read from your real hard drive.
*   **Task 1.1: `FileSystemService` Implementation**
    *   Create `frontend/src/lib/fs/FileSystemService.ts`.
    *   **Logic:** Use `window.showDirectoryPicker()` to get a handle. Store the handle in `IndexedDB` (using `idb-keyval`) so it persists across refreshes.
    *   **Function:** `verifyPermission(handle)` to check if we need to re-prompt for the "User Gesture."
*   **Task 1.2: The "Debug Workspace" Component**
    *   Create a temporary `frontend/src/pages/DebugFS.tsx`.
    *   **UI:** A button "Select Folder" and "Write Test File."
    *   **Manual Test:** Click button, select a folder on your desktop. Verify a `test.txt` appears there. Refresh the page; verify the app remembers the folder (but asks for permission to "Unlock").

### Milestone 2: The "Nightscout" Browser Fetcher
**Goal:** Prove the browser can talk to Nightscout without the Node.js backend.
*   **Task 2.1: Client Migration**
    *   Copy `backend/src/lib/nightscout/client.ts` to `frontend/src/lib/nightscout/client.ts`.
    *   **Change:** Replace `axios` with native `fetch()` to reduce bundle size and avoid Node-isms.
    *   **Change:** Remove the `validateUrl` private IP checks (the browser's same-origin policy handles this).
*   **Task 2.2: CORS Audit Tool**
    *   In `DebugFS.tsx`, add a "Test Nightscout Connection" form (URL + Secret).
    *   **Manual Test:** Enter your NS credentials. 
        *   **Success:** Console logs your last 10 glucose entries.
        *   **Failure:** App shows a "CORS Blocked" error with instructions on how to set `CORS_ALLOW_ALL=true`.

### Milestone 3: The "Analysis" Worker & Serializer
**Goal:** Run the heavy math in the background and format the Markdown.
*   **Task 3.1: Analysis Web Worker**
    *   Create `frontend/src/workers/analysis.worker.ts`.
    *   Import `calculateAgp` and `HotspotDetector` logic.
    *   **Verification:** Pass dummy data to the worker; verify it returns valid AGP stats (TIR, GMI) without freezing the UI.
*   **Task 3.2: `JournalSerializer`**
    *   Create `frontend/src/lib/markdown/JournalSerializer.ts`.
    *   Implement `serialize(data)`: Returns a string with YAML frontmatter + `# Weekly Journal` header.
    *   Implement `deserialize(string)`: Uses `gray-matter` (or `yaml`) to extract data.
    *   **Manual Test:** Use the Debug UI to "Save Mock Journal." Verify a file named `2026-03-10-weekly-journal.md` appears with correct YAML formatting.

### Milestone 4: The "Big Prune" (Destructive)
**Goal:** Remove the safety net and commit to the static architecture.
*   **Task 4.1: Backend Deletion**
    *   `rm -rf backend/`.
    *   Update `package.json` workspaces.
    *   Remove `next-auth`, `prisma`, `bullmq`, and `express` from all dependencies.
*   **Task 4.2: Shared Package Audit**
    *   Clean `@goodnumbers/common` of any `fs` or `crypto` imports that aren't browser-compatible.
    *   **Verification:** `npm run build:frontend` must pass without "Module not found" errors.

### Milestone 5: UI Reconstruction
**Goal:** Replace Auth pages with the "Workspace" flow.
*   **Task 5.1: The "Unlock" Gate**
    *   Replace `App.tsx` logic. If no Folder Handle is "Unlocked," redirect to `WorkspaceSetup.tsx`.
*   **Task 5.2: Dashboard File-Scan**
    *   Update Dashboard to `list()` the files in the folder handle, filtering for `.md`.
    *   Parse each file's frontmatter to show the "Past Weeks" list.
*   **Task 5.3: "Start Journal" Final Loop**
    *   Connect the "Start Journal" button to: `NS Fetch` -> `Worker Analysis` -> `FS Write` -> `Navigate to View`.

---

## 3. Acceptance Gates (For the Junior Eng)
| Gate | Verification Method | Expected Result |
| :--- | :--- | :--- |
| **FS Access** | `DebugFS.tsx` | File created on real disk. |
| **CORS Check** | `DebugFS.tsx` | Fetch returns JSON from Nightscout. |
| **Math Integrity** | Vitest | Worker stats match legacy backend stats 1:1. |
| **Bundle Size** | `npm run build` | Zero Node.js polyfills in final JS. |

## 4. "Make-Sure-You" Checklist
* [ ] **Handle Persistence:** Did you store the `FileSystemDirectoryHandle` in IndexedDB? (Standard `localStorage` cannot store handles).
* [ ] **Secret Safety:** Is the config file named `.goodnumbers.config.json`? (The dot prefix helps hide it).
* [ ] **Zod Validation:** Does the Dashboard catch errors if I manually type "abc" into the `gmi` field in the Markdown file?
* [ ] **User Gesture:** Does the "Unlock" button exist? (Browser will block `readwrite` if not triggered by a click).

## 5. Project Hygiene
1. **Branch:** `feat/static-migration-v2`.
2. **Issue:** "Phase 1: Side-by-Side Engine Development."
3. **TDD:** Write tests for `JournalSerializer` first. It is the most likely place for data corruption.
