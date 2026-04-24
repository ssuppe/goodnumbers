# Goodnumbers Implementation Plan

**Version:** 6.1 (Hypoglycemia Heuristics & Smart Zoom)
**Date:** 2026-04-24

## 1. Overview

This document tracks the phased implementation of the Goodnumbers project. It serves as the source of truth for engineering progress.

## 2. Testing Strategy

- **Unit Tests:** Vitest for individual modules (`backend/tests/unit`).
- **Integration Tests:** Vitest + Supertest for API routes (`backend/tests/integration`).
- **Frontend Tests:** Vitest + React Testing Library (`frontend/src/**/*.test.tsx`).

## 3. Implementation Phases

### **Phase 0-4: Foundation & Backend** - COMPLETE

- [x] **Phase 0:** Project Restructuring.
- [x] **Phase 1:** Setup, Database Schema, Express Server, Encryption.
- [x] **Phase 2:** Authentication (Auth.js), Email Allowlist, Onboarding Middleware.
- [x] **Phase 3:** Journal CRUD API, Job Queue (BullMQ/Redis), Status API.
- [x] **Phase 4:** Security Hardening (Cascading Deletes, Enforce Agreements).

### **Phase 5: Full-Stack Integration & UI** - COMPLETE

- [x] **Task 1:** Establish Monorepo (`backend`, `frontend`, `packages`).
- [x] **Task 2:** Shared Schemas Package (`@goodnumbers/schemas`).
- [x] **Task 3:** Shared Types Package (`@goodnumbers/types`).
- [x] **Task 3.5:** Refactor Shared Packages (Common package to fix bundling).
- [x] **Task 4:** Initialize React Frontend (Vite, Tailwind, Mesa Theme).
- [x] **Task 5:** Authentication Flow (Login, Agreements, Setup Pages).
- [x] **Task 6:** Dashboard & Journal Pages (AGP Chart, Cluster Cards, Input Forms).

### **Phase 6: Background Processing** - PARTIALLY COMPLETE

- [x] **Task 1: Data Fetching & Analysis**
  - Implemented `NightscoutClient` to fetch Entries, Treatments, and Profiles.
  - Implemented `HotspotDetector` for glycemic event clustering.
  - Implemented `calculateAgp` and `calculateMetrics` (Voyager Scorecards).
  - **COMPLETE:** Statistical Insights Engine (`aggregate.ts` and `cluster.ts`) with mandatory Zod validation and TDD workflow.
- [x] **Task 1.1: Hypoglycemia Heuristics & Smart Zoom**
  - **Goal:** Implement loop-aware hypoglycemia heuristics using velocity (ROC) and treatment presence.
  - **Status:** **COMPLETE**. Categorizes lows into Compression, Over-Announced, Aggressive Loop, or Background Drift.
  - **Status:** **COMPLETE**. Implemented "Smart Zoom" for hotspot charts to automatically expand to show relevant evidence.

- [x] **Task 2: AI & TTS Pipeline**
  - **Goal:** Integrate Gemini for insights and TTS for podcast audio.
  - **Status:** **COMPLETE** (AI Insights). Gemini 3.1 Pro/Flash integrated for clinical assessments and executive summaries. TTS/Podcast audio deferred to later phase.

### **Phase 7: UX Revamp & Cognitive Polish** - COMPLETE

- [x] **Task 1: Executive Summary Highlights**
  - Replaced narrative paragraphs with 3 scannable highlight cards (Win, Trend, Warning).
  - Updated Gemini prompt to return structured JSON highlights based on AGP stats.
- [x] **Task 2: Purely Visual AGP Metrics**
  - Moved AGP metrics (Avg, TIR, Stability, GMI) to a clean 4-column grid above the chart.
  - Removed dense explanatory text beneath the AGP chart to reduce data fatigue.
- [x] **Task 3: AI Co-pilot & Progressive Disclosure**
  - Wrapped AI clinical assessments in a collapsible "✨ AI Co-pilot Hypothesis" section.
  - Implemented "Quick Log" chips to allow one-tap journaling suggestions.
- [x] **Task 4: Data Resilience**
  - Updated worker to preserve `userNotes` when recreating clusters.
  - Standardized `Highlight` and other types in the mono-repo.

### **Phase 8: Future Work & Polish**

- [ ] **Task 1: Podcast Audio:** Implement TTS generation for the weekly summary.
- [ ] **Task 2: RSS Token Endpoint:** Implement `POST /api/user/regenerate-rss-token`.
- [ ] **Task 3: Production Logging:** Replace `console.log` with a structured logger (Winston/Pino).
- [ ] **Task 4: E2E Testing:** Implement Playwright tests for critical user journeys.

### **Phase 9: Infrastructure & Deployment** - IN PROGRESS

- [x] **Task 1: Dockerization**
  - Create optimized Dockerfiles for `backend` (with PM2) and `frontend` (with Nginx).
- [x] **Task 2: Orchestration**
  - Implement `docker-compose.yml` and `Caddyfile` for automated reverse proxy and SSL.
- [ ] **Task 3: VM Hardening**
  - Configure swap space on GCP e2-micro to prevent OOM errors.
- [ ] **Task 4: Automation**
  - Finalize `Justfile` commands for seamless production deployment (`just deploy`).
