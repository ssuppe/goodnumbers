# Technical Specification: Goodnumbers Static

**Version:** 2.0 (Static/Client-only)
**Date:** 2026-03-10

## 1. Introduction

This specification details the transition from a full-stack SaaS model to a static, single-user progressive web app. All processing occurs in the browser, and all data is stored on the user's local disk via the Web File System Access API.

## 2. Core Architecture

- **Frontend:** React (TypeScript) + Vite.
- **Backend:** None.
- **Storage Engine:** Web File System Access API (`showDirectoryPicker`).
- **Data Persistence:** 
  - **Journals:** Markdown files with YAML frontmatter (`YYYY-MM-DD-weekly-journal.md`).
  - **Configuration:** Hidden JSON file (`.goodnumbers.config.json`) in the workspace.
- **Computation:** Analysis (AGP, Metrics, Clusters) performed in a Web Worker to prevent UI blocking.
- **Networking:** Direct browser-to-Nightscout API requests (requires CORS to be enabled on the Nightscout instance).

## 3. Data Model (Markdown/YAML)

Journals are serialized to `.md` files using the following YAML frontmatter:

```yaml
---
date: "2026-03-10T00:00:00Z"
nightscoutUrl: "https://your-nightscout.com"
preferredUnits: "MGDL"
metrics:
  avgGlucose: 145
  stability: 22
  timeInRange: 75
  timeInTightRange: 55
clusters:
  - eventType: "HYPO"
    eventCount: 3
    meanTimeMinutes: 45
    clusterDataJson: [...]
vibe: "🌱 Sprouting"
influencingFactors: ["Alcohol", "Strenuous Exercise"]
---
# Weekly Journal Notes

User's subjective reflection goes here...
```

## 4. Permission & Security Model

1. **User Gesture Requirement:** The browser requires a click to re-authorize "readwrite" access to the workspace handle on every session start. The app implements an "Unlock Workspace" splash screen.
2. **Handle Persistence:** The `FileSystemDirectoryHandle` is stored in IndexedDB (via `idb-keyval`).
3. **Zero Knowledge:** Credentials (Nightscout API Secret) are stored in the local workspace's hidden config file and are only used for direct requests to the user's Nightscout instance.

## 5. Implementation Phases (Summary)

1. **Milestone 1:** FileSystem Bridge (Read/Write test).
2. **Milestone 2:** Nightscout Client Fetch (Browser-to-NS).
3. **Milestone 3:** Analysis Worker & Markdown Serializer.
4. **Milestone 4:** Remove Backend Code & Shared Package Audit.
5. **Milestone 5:** UI Reconstruction (Workspace Setup & Dashboard).
