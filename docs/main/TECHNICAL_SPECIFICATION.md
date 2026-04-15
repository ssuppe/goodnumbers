# Technical Specification: Goodnumbers Static

**Version:** 3.0 (Unhosted/IndexedDB + GitHub Sync)
**Date:** 2026-03-11

## 1. Introduction

Goodnumbers Static is an unhosted web app for diabetes tracking. All data is stored in the browser's IndexedDB and synchronized to a private GitHub repository.

## 2. Core Architecture

- **Frontend:** React (TypeScript) + Vite.
- **Backend:** None.
- **Local Storage Engine:** IndexedDB (via `idb`).
- **Remote Sync Engine:** GitHub REST API (via `@octokit/rest`).
- **Data Formats:** 
  - **Journals:** Markdown files with YAML frontmatter (`/entries/YYYY-MM-DD-weekly-journal.md`).
  - **Configuration:** Local browser storage (idb-keyval).
- **Computation:** Analysis (AGP, Metrics, Clusters) performed in a Web Worker to prevent UI blocking.
- **Networking:** Direct browser-to-Nightscout and browser-to-GitHub API requests.

## 3. Data Model (Markdown/YAML)

Journals are serialized to `.md` files using the following YAML frontmatter:

```yaml
---
id: "550e8400-e29b-41d4-a716-446655440000"
date: "2026-03-10T00:00:00Z"
nightscoutUrl: "https://your-nightscout.com"
metrics:
  avgGlucose: 145
  stability: 22
  timeInRange: 75
---
# Weekly Journal Notes

User's subjective reflection goes here...
```

## 4. Storage & Sync Engine Logic

### A. Local-First Writes
1. User saves an entry in the UI.
2. App writes the JSON object to IndexedDB with `sync_status: 'pending_push'`.
3. UI updates immediately. Background sync engine triggers.

### B. Sync Engine: Push (Local -> GitHub)
1. Query IndexedDB for entries with `sync_status === 'pending_push'`.
2. For each record, convert to Markdown/YAML string.
3. Use GitHub API to `PUT` content to `/entries/{filename}.md`.
4. On success, update record in IndexedDB with `sync_status: 'synced'` and the new `github_sha`.

### C. Sync Engine: Pull (GitHub -> Local)
1. Fetch the repository file tree (`GET /repos/{owner}/{repo}/git/trees/main?recursive=1`).
2. Compare remote SHAs against local `github_sha` values.
3. If remote is different or missing locally, fetch raw content.
4. Parse and upsert into IndexedDB, setting `sync_status: 'synced'`.

## 5. Security Model

1. **Zero Knowledge:** All credentials (NS Secret, GitHub PAT) stay in the user's browser.
2. **Fine-grained PAT:** Users are encouraged to use GitHub fine-grained tokens restricted to a single repository.

## 6. Implementation Phases

1. **Milestone 1:** DX & Testing Foundation (Done).
2. **Milestone 2:** Storage & Sync Engine (IndexedDB + GitHub).
3. **Milestone 3:** Nightscout Client & Markdown Serializer.
4. **Milestone 4:** Analysis Worker & Logic Migration.
5. **Milestone 5:** UI Reconstruction (Setup & Dashboard).
