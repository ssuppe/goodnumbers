# Goodnumbers Weekly Health Journal PRD

**Revision:** v2.0 (Static/Unhosted)

GoodNumbers is a simple, static, single-user weekly health journal for Type 1 Diabetics. It combines a diary/bullet journal with statistical CGM analysis, storing all data in the browser's IndexedDB and synchronizing it to a private GitHub repository.

**Problem:** Type 1 Diabetics often lack a simple, private way to identify weekly trends without relying on complex SaaS platforms or centralized databases.

**Solution:** GoodNumbers provides a purely client-side practice of self-reflection. It leverages:

- **Data Analysis:** Runs entirely in the browser to find "hotspots" and trends in blood glucose numbers.
- **Local-First Storage:** All data is stored in the browser's **IndexedDB** for instant load times and full offline capability.
- **GitHub Sync:** Data is synchronized to a user-owned, private GitHub repository using a Personal Access Token (PAT). This ensures cross-platform (Desktop/Mobile) support and data ownership.
- **Zero Knowledge:** Credentials (Nightscout, GitHub PAT) are stored locally in the browser and never leave the user's environment.
- **Portability:** Journals are human-readable Markdown/YAML on GitHub, making them easy to share or archive independently of the application.

The goal of GoodNumbers is to give Type 1 Diabetics a weekly practice of self-reflection, including:

- A pause in the week to look back over the last week, see how they are feeling, and celebrate wins and places to improve.
- Reviewing trends and "hotspots" via statistical analyses processed directly from their Nightscout instance.
- Optional AI-generated insights if the user provides their own API keys.

GoodNumbers is motivating, judgment-free, and prioritizes data ownership and simplicity.

**Note:** GoodNumbers does NOT provide medical advice; it recognizes patterns for the user to discuss with their healthcare team.

## UX Design System

The design is clean, professional, calm, and supportive ("Mesa" theme: Terracotta and Petrol Blue). It uses a card-based architecture on an off-white background (`#F4F1EA`).

### Color Palette

- **Primary:** Terracotta (`#D9775B`)
- **Secondary:** Petrol Blue (`#2C4C5B`)
- **Critical:** Red (`#D32F2F`)
- **Background:** Off-white (`#F4F1EA`)

## User Journey: The Unhosted Flow

### 1. Setup (Onboarding)
User provides their Nightscout URL/Secret and GitHub details (Username, Repo, PAT). 
- Validates credentials via direct browser-to-API requests.
- Fetches existing journals from GitHub if the repo is already populated.

### 2. Dashboard
Displays a list of past journals from IndexedDB.
- **Primary Action:** "Log this week's journal".
- **Status:** Shows "Syncing..." or "Synced" indicators.

### 3. Journal Generation
- Fetches 7 days of data directly from Nightscout (Client-side).
- Analyzes data (Web Worker).
- Saves as a new entry in IndexedDB (marked as `pending_push`).
- Sync Engine pushes the new Markdown file to GitHub in the background.

### 4. Journal View
Displays AGP charts, scorecard metrics, and glycemic event clusters. Allows editing subjective notes.
